import { createHash, randomBytes } from "node:crypto";

/**
 * OAuth-style Device Authorization Flow (RFC 8628-shaped, + PKCE) against
 * the Kurumera backend's `/api/v1/cli/device/*` endpoints — see
 * `apps/cli_auth` (theplantsmall-backend). Works whenever the CLI can reach
 * the API over the internet, regardless of where the approving browser runs.
 *
 * Pure data/network layer — no console output, no browser-opening, no
 * polling loop, no filesystem access. commands/login.ts composes these into
 * each mode's UX (--start prints once and exits; --complete makes exactly
 * one attempt; --wait loops in-process); util/pendingDeviceAuth.ts persists
 * the state a --start/--complete split needs to survive across processes.
 */

export interface DeviceAuthStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  codeVerifier: string;
  /** Seconds. */
  expiresIn: number;
  /** Seconds — the server's requested minimum poll interval. */
  interval: number;
}

export interface DeviceTokenSuccess {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms. */
  expiresAt: number;
  scopes: string[];
}

export interface DeviceTokenErrorInfo {
  /** RFC 8628 error code: authorization_pending | slow_down | access_denied |
   *  expired_token | invalid_grant | invalid_request | … */
  error: string;
  errorDescription?: string;
  httpStatus: number;
}

export type DeviceTokenResult =
  | { ok: true; result: DeviceTokenSuccess }
  | { ok: false; error: DeviceTokenErrorInfo };

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

interface AuthorizeResponse {
  device_code?: string;
  user_code?: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  expires_in?: number;
  interval?: number;
  error?: string;
  error_description?: string;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * Start a device authorization — exactly one request, no polling. Scopes
 * default to the server's least-privilege set
 * (apps/cli_auth/scopes.py DEFAULT_CLI_SCOPES) when omitted.
 */
export async function startDeviceAuthorization(apiUrl: string, scopes?: string[]): Promise<DeviceAuthStart> {
  const { verifier, challenge } = generatePkce();
  const base = apiUrl.replace(/\/+$/, "");

  const authRes = await fetch(`${base}/cli/device/authorize/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: "kurumera-cli",
      code_challenge: challenge,
      code_challenge_method: "S256",
      ...(scopes && scopes.length ? { scopes } : {}),
    }),
  });
  const body = (await authRes.json().catch(() => ({}))) as AuthorizeResponse;
  if (!authRes.ok || !body.device_code || !body.user_code) {
    throw new Error(body.error_description || body.error || `Could not start device authorization (${authRes.status}).`);
  }

  return {
    deviceCode: body.device_code,
    userCode: body.user_code,
    verificationUri: body.verification_uri || "",
    verificationUriComplete: body.verification_uri_complete || "",
    codeVerifier: verifier,
    expiresIn: Math.max(30, Number(body.expires_in) || 600),
    interval: Math.max(1, Number(body.interval) || 5),
  };
}

/**
 * One single token-endpoint attempt — never loops, never throws on a normal
 * RFC 8628 protocol rejection (authorization_pending, slow_down,
 * access_denied, expired_token, invalid_grant, …); those come back as
 * `{ ok: false, error }` for the caller to interpret and act on. Only a
 * genuine network/transport failure throws.
 */
export async function exchangeDeviceCode(
  tokenEndpoint: string, deviceCode: string, codeVerifier: string,
): Promise<DeviceTokenResult> {
  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode,
      code_verifier: codeVerifier,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;

  if (res.ok && body.access_token) {
    return {
      ok: true,
      result: {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        expiresAt: Date.now() + Math.max(1, Number(body.expires_in) || 3600) * 1000,
        scopes: String(body.scope || "").split(" ").filter(Boolean),
      },
    };
  }
  return {
    ok: false,
    error: {
      error: body.error || "unknown_error",
      errorDescription: body.error_description,
      httpStatus: res.status,
    },
  };
}

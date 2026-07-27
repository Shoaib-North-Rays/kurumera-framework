import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";

/**
 * OAuth-style Device Authorization Flow (RFC 8628-shaped, + PKCE) against
 * the Kurumera backend's `/api/v1/cli/device/*` endpoints — see
 * `apps/cli_auth` (theplantsmall-backend). Works whenever the CLI can reach
 * the API over the internet, regardless of where the approving browser runs.
 */

export interface DeviceLoginResult {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms. */
  expiresAt: number;
  scopes: string[];
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function openBrowser(url: string): void {
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url.replace(/&/g, "^&")], {
        stdio: "ignore", detached: true, windowsVerbatimArguments: true,
      }).unref();
      return;
    }
    spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { stdio: "ignore", detached: true }).unref();
  } catch {
    /* the URL is printed as a fallback */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
 * Run the full device-flow login: start it, print/open the verification URL,
 * then poll until a human approves it on `/device` (or it's denied/expires).
 *
 * Scopes requested default to the server's least-privilege default set
 * (see apps/cli_auth/scopes.py DEFAULT_CLI_SCOPES) when omitted.
 */
export async function deviceLogin(apiUrl: string, scopes?: string[]): Promise<DeviceLoginResult> {
  const { verifier, challenge } = generatePkce();

  const authRes = await fetch(`${apiUrl}/cli/device/authorize/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: "kurumera-cli",
      code_challenge: challenge,
      code_challenge_method: "S256",
      ...(scopes && scopes.length ? { scopes } : {}),
    }),
  });
  const auth = (await authRes.json().catch(() => ({}))) as AuthorizeResponse;
  if (!authRes.ok || !auth.device_code || !auth.user_code) {
    throw new Error(auth.error_description || auth.error || `Could not start device login (${authRes.status}).`);
  }

  console.log("To sign in, open this link (on this machine or any other device):\n");
  console.log(`  ${auth.verification_uri_complete}\n`);
  console.log(`Or go to ${auth.verification_uri} and enter this code: ${auth.user_code}\n`);
  if (auth.verification_uri_complete) openBrowser(auth.verification_uri_complete);
  console.log("Waiting for you to authorize this device…");

  let interval = Math.max(1, Number(auth.interval) || 5);
  const deadline = Date.now() + Math.max(30, Number(auth.expires_in) || 600) * 1000;

  while (Date.now() < deadline) {
    await sleep(interval * 1000);

    const tokenRes = await fetch(`${apiUrl}/cli/device/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: auth.device_code,
        code_verifier: verifier,
      }),
    });
    const body = (await tokenRes.json().catch(() => ({}))) as TokenResponse;

    if (tokenRes.ok && body.access_token) {
      return {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        expiresAt: Date.now() + Math.max(1, Number(body.expires_in) || 3600) * 1000,
        scopes: String(body.scope || "").split(" ").filter(Boolean),
      };
    }
    if (body.error === "authorization_pending") continue;
    if (body.error === "slow_down") { interval += 5; continue; }
    throw new Error(body.error_description || body.error || `Device login failed (${tokenRes.status}).`);
  }
  throw new Error("Timed out waiting for authorization — run `kurumera login --device` again.");
}

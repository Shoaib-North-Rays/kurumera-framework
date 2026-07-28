import { join } from "node:path";
import { readFileSync, writeFileSync, unlinkSync, renameSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { readConfig, writeConfig } from "./config.js";
import { resolveConfigDir, ensureConfigDir } from "./configDir.js";
import { resolveAuthUrl } from "./authUrl.js";

/**
 * Incremental consent — when a command fails with a structured
 * `missing_scope` 403 (apps/cli_auth's ThemeAuthzView), request just the
 * missing scope for the EXISTING session instead of abandoning it and
 * starting a brand-new `kurumera login --device` from scratch. Mirrors
 * `--start`/`--complete`'s resumable shape (one attempt, exit, no loop —
 * safe for a hosted agent sandbox that may not stay alive between calls),
 * but against `/cli/device/amend/` (a bearer-authenticated amendment to the
 * CALLING session, not an anonymous fresh device code) — see
 * apps/cli_auth/views.py::DeviceAmendView.
 *
 * Deliberately a SEPARATE pending-state file from pendingDeviceAuth.ts's
 * `pending-device-auth.json` — an in-flight scope amendment and an in-flight
 * fresh login are different things and must never stomp on each other.
 */

interface PendingAmend {
  deviceCode: string;
  tokenEndpoint: string;
  verificationUri: string;
  requestedScope: string;
  expiresAt: number; // epoch ms
  interval: number; // seconds
}

const FILE = join(resolveConfigDir(), "pending-amend.json");

function readPending(): PendingAmend | undefined {
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Partial<PendingAmend>;
    if (!parsed || typeof parsed.deviceCode !== "string" || typeof parsed.tokenEndpoint !== "string") return undefined;
    return parsed as PendingAmend;
  } catch {
    return undefined;
  }
}

function writePending(pending: PendingAmend): void {
  const dir = resolveConfigDir();
  ensureConfigDir(dir);
  const tmp = join(dir, `.pending-amend.${randomBytes(6).toString("hex")}.tmp`);
  writeFileSync(tmp, JSON.stringify(pending, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, FILE);
}

function clearPending(): void {
  try { unlinkSync(FILE); } catch { /* already gone */ }
}

interface AmendResponse {
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
  amended?: boolean;
  scopes?: string[];
  authorized_stores?: string[];
  error?: string;
  error_description?: string;
}

/**
 * Start a scope amendment for the CURRENT session and print the approval
 * URL/code — exactly one request, no polling, exits back to the caller
 * immediately. The caller (push.ts/publish.ts) should tell the human/agent
 * to approve, then simply re-run the SAME command — resolveAuthToken() and
 * a fresh missing_scope check will call tryCompletePendingAmend()
 * automatically on the next attempt.
 */
export async function requestScopeAmend(requiredScope: string, authToken: string): Promise<void> {
  const base = resolveAuthUrl().replace(/\/+$/, "");
  let body: AmendResponse;
  try {
    const res = await fetch(`${base}/cli/device/amend/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ scopes: [requiredScope] }),
    });
    body = (await res.json().catch(() => ({}))) as AmendResponse;
    if (!res.ok || !body.device_code || !body.user_code) {
      console.error(`Could not request additional access: ${body.error_description || body.error || `HTTP ${res.status}`}`);
      return;
    }
  } catch (e) {
    console.error(`Could not request additional access: ${(e as Error).message}`);
    return;
  }

  writePending({
    deviceCode: body.device_code,
    tokenEndpoint: `${base}/cli/device/token/`,
    verificationUri: body.verification_uri || "",
    requestedScope: requiredScope,
    expiresAt: Date.now() + Math.max(30, Number(body.expires_in) || 600) * 1000,
    interval: Math.max(1, Number(body.interval) || 5),
  });

  console.log(`\nThis connection doesn't have the "${requiredScope}" permission yet.\n`);
  console.log("Open this URL in any browser to grant it — your existing session keeps everything it already has:\n");
  console.log(`  ${body.verification_uri_complete || body.verification_uri}\n`);
  console.log(`Code: ${body.user_code}\n`);
  console.log("After approving, just run the same command again.");
}

/**
 * Called automatically before reporting a missing_scope failure — if a
 * previously-requested amendment has since been approved, apply it and
 * retry transparently instead of asking the human to approve AGAIN for a
 * request that's already been granted. Returns true iff the amendment was
 * just successfully applied (scopes merged into local config) — the caller
 * should retry its original operation once in that case.
 */
export async function tryCompletePendingAmend(): Promise<boolean> {
  const pending = readPending();
  if (!pending) return false;
  if (Date.now() >= pending.expiresAt) {
    clearPending();
    return false;
  }

  let body: TokenResponse;
  try {
    const res = await fetch(pending.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: pending.deviceCode,
        code_verifier: "", // amendments carry no PKCE — see class docstring
      }),
    });
    body = (await res.json().catch(() => ({}))) as TokenResponse;
    if (!res.ok) return false; // still pending / denied / expired — nothing to apply yet
  } catch {
    return false; // transient — leave the pending state for the next attempt
  }

  if (!body.amended || !Array.isArray(body.scopes)) return false;

  const cfg = readConfig();
  if (cfg.auth) {
    cfg.auth.scopes = Array.from(new Set([...(cfg.auth.scopes || []), ...body.scopes]));
    writeConfig(cfg);
  }
  clearPending();
  console.log(`✓ Additional access granted: ${body.scopes.join(", ")}`);
  return true;
}

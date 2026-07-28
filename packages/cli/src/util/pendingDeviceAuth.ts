import { join } from "node:path";
import { readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolveConfigDir, ensureConfigDir } from "./configDir.js";

const DIR = resolveConfigDir();
const FILE = join(DIR, "pending-device-auth.json");

/**
 * A device authorization started with `kurumera login --device --start`,
 * waiting to be completed by a (possibly separate, possibly much later)
 * process. Kept in its OWN file, deliberately never merged into
 * config.json — it holds short-lived, single-use secrets (deviceCode,
 * codeVerifier) that must never be confused with, or persisted alongside,
 * a durable CLI session.
 */
export interface PendingDeviceAuth {
  deviceCode: string;
  codeVerifier: string;
  tokenEndpoint: string;
  verificationUri: string;
  /** Epoch ms. */
  expiresAt: number;
  /** Seconds — the server's requested minimum poll interval. */
  interval: number;
  /** Epoch ms. */
  createdAt: number;
}

export const PENDING_DEVICE_AUTH_PATH = FILE;

/**
 * Read the pending authorization, or `undefined` if there isn't one — which
 * covers "file doesn't exist," "file is invalid JSON," and "file is missing
 * a required field" identically. A caller never needs to distinguish those:
 * all three mean "there is nothing usable to complete," and all three are
 * safe to treat as "start a new one."
 */
export function readPendingDeviceAuth(): PendingDeviceAuth | undefined {
  let raw: string;
  try {
    raw = readFileSync(FILE, "utf8");
  } catch {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }

  if (!parsed || typeof parsed !== "object") return undefined;
  const p = parsed as Partial<PendingDeviceAuth>;
  if (
    typeof p.deviceCode !== "string" || !p.deviceCode ||
    typeof p.codeVerifier !== "string" || !p.codeVerifier ||
    typeof p.tokenEndpoint !== "string" || !p.tokenEndpoint ||
    typeof p.expiresAt !== "number"
  ) {
    return undefined;
  }
  return p as PendingDeviceAuth;
}

/**
 * Persist a pending authorization — atomically (write to a temp file in the
 * SAME directory, then rename over the target, so a concurrent reader never
 * observes a partially-written file) and with restrictive permissions
 * (0700 dir / 0600 file — this file holds a bearer-equivalent secret pair
 * for as long as it's pending). Safely REPLACES any prior pending
 * authorization, expired or not — starting again is always safe.
 */
export function writePendingDeviceAuth(pending: PendingDeviceAuth): void {
  ensureConfigDir(DIR);
  const tmp = join(DIR, `.pending-device-auth.${randomBytes(6).toString("hex")}.tmp`);
  writeFileSync(tmp, JSON.stringify(pending, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, FILE);
}

/** Idempotent — clearing an already-absent pending authorization is a no-op. */
export function clearPendingDeviceAuth(): void {
  try {
    unlinkSync(FILE);
  } catch {
    /* already gone */
  }
}

export function isPendingExpired(pending: PendingDeviceAuth): boolean {
  return Date.now() >= pending.expiresAt;
}

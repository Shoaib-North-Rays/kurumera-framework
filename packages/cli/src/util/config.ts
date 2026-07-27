import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = join(homedir(), ".kurumera");
const FILE = join(DIR, "config.json");

/** A remote-safe (device-flow) or manually-issued CLI session — see
 *  `util/deviceAuth.ts` and `util/resolveAuthToken.ts`. Kept STRUCTURED and
 *  SEPARATE from the legacy flat `authToken`/`refresh` fields below so a
 *  session saved by an older CLI (loopback-only) keeps working untouched. */
export interface CliAuthSession {
  type: "device" | "manual";
  /** `kcli_…` */
  accessToken: string;
  /** `kclr_…` — absent for a manual (CI) token, which has no refresh cycle. */
  refreshToken?: string;
  /** Epoch ms. Absent = doesn't expire (a non-expiring manual CI token). */
  expiresAt?: number;
  scopes: string[];
}

export interface CliConfig {
  apiUrl?: string;
  /** Developer session from `kurumera login` (browser authorize, loopback). */
  authToken?: string;
  refresh?: string;
  /** The developer's default store slug (from login). */
  defaultStore?: string;
  /** Fallback storefront token when no per-store token is set. */
  token?: string;
  /** Per-store storefront tokens, keyed by store slug. */
  stores?: Record<string, string>;
  /** Marketplace license keys, keyed by theme slug (saved on purchase/install). */
  licenses?: Record<string, string>;
  /** Remote-safe (device-flow) session — see CliAuthSession. */
  auth?: CliAuthSession;
}

export function readConfig(): CliConfig {
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as CliConfig;
  } catch {
    return {};
  }
}

export function writeConfig(cfg: CliConfig): void {
  // 0700 dir / 0600 file — the config holds session + storefront tokens and license
  // keys, so it must not be world-readable on shared machines.
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true, mode: 0o700 });
  writeFileSync(FILE, JSON.stringify(cfg, null, 2) + "\n", { mode: 0o600 });
}

export const CONFIG_PATH = FILE;

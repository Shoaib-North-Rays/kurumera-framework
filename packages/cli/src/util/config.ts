import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = join(homedir(), ".kurumera");
const FILE = join(DIR, "config.json");

export interface CliConfig {
  apiUrl?: string;
  /** Developer session from `kurumera login` (browser authorize). */
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

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
}

export function readConfig(): CliConfig {
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as CliConfig;
  } catch {
    return {};
  }
}

export function writeConfig(cfg: CliConfig): void {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(cfg, null, 2) + "\n");
}

export const CONFIG_PATH = FILE;

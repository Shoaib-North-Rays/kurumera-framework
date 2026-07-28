import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const ENV_OVERRIDE = "KURUMERA_CONFIG_DIR";

/**
 * Base directory for all Kurumera CLI state (config.json,
 * pending-device-auth.json).
 *
 * Some sandboxed/hosted AI-agent environments report a HOME directory
 * (`os.homedir()`, e.g. `/root`) that doesn't actually exist or isn't
 * writable by the process — `mkdir` then fails with a raw ENOENT/EACCES
 * that gives no hint about how to fix it. `KURUMERA_CONFIG_DIR` lets that
 * environment point the CLI at a directory it KNOWS is writable (e.g.
 * `/tmp/kurumera-config`) instead.
 */
export function resolveConfigDir(): string {
  const override = process.env[ENV_OVERRIDE];
  if (override) return override;
  return join(homedir(), ".kurumera");
}

/**
 * Ensure `dir` exists (0700), with a clear, actionable error — naming the
 * `KURUMERA_CONFIG_DIR` escape hatch — if it can't be created. Every write
 * path (config.json, pending-device-auth.json) calls this first.
 */
export function ensureConfigDir(dir: string): void {
  if (existsSync(dir)) return;
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  } catch (e) {
    throw new Error(
      `Could not create the Kurumera config directory at "${dir}": ${(e as Error).message}. ` +
      `If this environment's home directory isn't writable, set ${ENV_OVERRIDE} to a writable ` +
      `path (e.g. /tmp/kurumera-config) and try again.`,
    );
  }
}

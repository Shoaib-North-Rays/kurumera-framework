import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { readConfig } from "../util/config.js";
import { resolveAuthToken } from "../util/resolveAuthToken.js";

// Minimal ANSI colour helpers (no dependency); no-op when output isn't a TTY.
const TTY = process.stdout.isTTY;
const paint = (code: string, s: string) => (TTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = (s: string) => paint("32", s);
const cyan = (s: string) => paint("36", s);
const dim = (s: string) => paint("2", s);

const PUSH_URL = (process.env.KURUMERA_PUSH_URL || "https://themekit.kurumera.com/_push").replace(/\/+$/, "");

/**
 * `kurumera theme checkpoint <restore|status>` — recover from the background
 * auto-save `theme dev` performs every few minutes (see startCheckpointing in
 * dev.ts). This is DISASTER RECOVERY for edits that never reached a real
 * `theme push` — once you've pushed at least once, use `theme pull` instead,
 * which recovers a real, permanently-retained, immutable version.
 */
export async function themeCheckpoint(args: string[]): Promise<number> {
  const sub = args[0];
  const rest = args.slice(1);
  if (sub === "restore") return restore(rest);
  if (sub === "status") return status(rest);
  console.error("Usage: kurumera theme checkpoint <restore|status> --store <slug> [--out <dir>]");
  return 1;
}

async function status(args: string[]): Promise<number> {
  const cfg = readConfig();
  const store = flag(args, "--store") || cfg.defaultStore;
  if (!store) { console.error("Which store? Pass --store <slug>."); return 1; }
  const authToken = await resolveAuthToken();
  if (!authToken) { console.error("Not signed in. Run `kurumera login` first."); return 1; }

  let res: Response;
  try {
    res = await fetch(`${PUSH_URL}/checkpoint/status?store=${encodeURIComponent(store)}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
  } catch (e) {
    console.error(`Request failed: ${(e as Error).message}`);
    return 1;
  }
  const d = (await res.json().catch(() => ({}))) as { exists?: boolean; updatedAt?: string; bytes?: number; error?: string; detail?: string };
  if (!res.ok) { console.error(`Failed (${res.status}): ${d.detail || d.error || "unknown error"}`); return 1; }
  if (!d.exists) { console.log(`No checkpoint retained for "${store}".`); return 0; }
  const ageMs = Date.now() - new Date(d.updatedAt || 0).getTime();
  const ageMin = Math.max(0, Math.round(ageMs / 60000));
  console.log(`Checkpoint for "${store}": saved ${ageMin === 0 ? "just now" : `${ageMin} min ago`} (${((d.bytes || 0) / 1024).toFixed(0)} KB).`);
  console.log(`  Restore:  kurumera theme checkpoint restore --store ${store}`);
  return 0;
}

async function restore(args: string[]): Promise<number> {
  const cfg = readConfig();
  const store = flag(args, "--store") || cfg.defaultStore;
  if (!store) { console.error("Which store? Pass --store <slug>."); return 1; }
  const dir = flag(args, "--out") || `${store}-checkpoint`;
  if (existsSync(dir)) { console.error(`"${dir}" already exists — pass --out <folder> for a fresh location.`); return 1; }

  const authToken = await resolveAuthToken();
  if (!authToken) { console.error("Not signed in. Run `kurumera login` first."); return 1; }

  process.stdout.write(dim(`  restoring checkpoint for ${store}… `));
  let res: Response;
  try {
    res = await fetch(`${PUSH_URL}/checkpoint?store=${encodeURIComponent(store)}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
  } catch (e) {
    console.error(`\nRequest failed: ${(e as Error).message}`);
    return 1;
  }
  if (res.status === 404) {
    console.error(`\nNo checkpoint retained for "${store}" — nothing to restore.`);
    return 1;
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
    console.error(`\nRestore failed (${res.status}): ${body.detail || body.error || "unknown error"}`);
    return 1;
  }

  mkdirSync(dir, { recursive: true });
  const bytes = Buffer.from(await res.arrayBuffer());
  process.stdout.write(dim("extracting… "));
  const tar = spawn("tar", ["-xzf", "-", "-C", dir], { stdio: ["pipe", "inherit", "inherit"] });
  const ok = await new Promise<boolean>((done) => {
    tar.on("error", () => done(false));
    tar.on("close", (code) => done(code === 0));
    tar.stdin.write(bytes); tar.stdin.end();
  });

  const abs = resolve(dir);
  if (!ok || !existsSync(dir) || !readdirSync(dir).length) {
    try { if (existsSync(dir)) rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
    console.error("\nCouldn't extract the checkpoint — make sure `tar` is installed (it ships with Windows 10+, macOS and Linux).");
    return 1;
  }

  writeLocalTenantEnv(dir, store);

  const q = abs.includes(" ") ? `"${abs}"` : abs;
  console.log(`\n${green("✓")} Restored checkpoint for "${store}"  (${readdirSync(dir).length} items)`);
  console.log(`  ${dim("Folder:")}  ${cyan(abs)}`);
  console.log(`  ${dim("Set up:")}  cd ${q} && npm install`);
  console.log(`  ${dim("Resume:")}  kurumera theme dev --store ${store}`);
  console.log(dim("  This is a recovered IN-PROGRESS snapshot, not a pushed version — check it over, then `theme push` when ready."));
  return 0;
}

// Same auto-fix as `theme pull` — a downloaded/restored project has no
// .env.local (gitignored at push/checkpoint time), and getStore() can't
// resolve a store from a bare localhost request without one.
function writeLocalTenantEnv(dir: string, store: string): void {
  const envPath = join(dir, ".env.local");
  if (existsSync(envPath)) {
    const existing = readFileSync(envPath, "utf8");
    if (/^KURUMERA_TENANT=/m.test(existing)) return;
    writeFileSync(envPath, `${existing.replace(/\n?$/, "\n")}KURUMERA_TENANT=${store}\n`);
    return;
  }
  writeFileSync(envPath, `KURUMERA_TENANT=${store}\n`);
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
}

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
 * `kurumera theme pull --store <slug> --version <id> [--out <dir>]` —
 * download a previously-pushed version's ORIGINAL source (see
 * `kurumera theme versions` for available ids). Mirrors `marketplace
 * clone`'s download+extract pattern, scoped to your own store's push
 * history (bearer-authed) instead of the public marketplace registry.
 */
export async function themePull(args: string[]): Promise<number> {
  const cfg = readConfig();
  const store = flag(args, "--store") || cfg.defaultStore;
  if (!store) { console.error("Which store? Pass --store <slug>."); return 1; }
  const version = flag(args, "--version");
  if (!version) { console.error("Which version? Pass --version <id> (see `kurumera theme versions --store <slug>`)."); return 1; }
  const dir = flag(args, "--out") || `${store}-${version}`;
  if (existsSync(dir)) { console.error(`"${dir}" already exists — pass --out <folder> for a fresh location.`); return 1; }

  const authToken = await resolveAuthToken();
  if (!authToken) { console.error("Not signed in. Run `kurumera login` first."); return 1; }

  process.stdout.write(dim(`  pulling ${store}@${version}… `));
  let res: Response;
  try {
    res = await fetch(`${PUSH_URL}/source?store=${encodeURIComponent(store)}&version=${encodeURIComponent(version)}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
  } catch (e) {
    console.error(`\nRequest failed: ${(e as Error).message}`);
    return 1;
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
    console.error(`\nPull failed (${res.status}): ${body.detail || body.error || "unknown error"}`);
    return 1;
  }

  // Pipe the gzipped tarball straight into `tar` (bundled with Windows 10+, macOS, Linux).
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
    console.error("\nCouldn't extract the source — make sure `tar` is installed (it ships with Windows 10+, macOS and Linux).");
    return 1;
  }

  // `getStore()` (base-theme/lib/kurumera.ts) can't resolve a store from a
  // bare `localhost` request — it needs KURUMERA_TENANT set for local dev.
  // The pulled bundle is a raw copy of what got pushed, which never carries
  // this (it's gitignored), so without it every pull 500s on first `next
  // dev`. Write it in, but don't clobber a real .env.local the project
  // already shipped with — only add the var if it's missing.
  writeLocalTenantEnv(dir, store);

  const q = abs.includes(" ") ? `"${abs}"` : abs;
  console.log(`\n${green("✓")} Pulled ${store}@${version}  (${readdirSync(dir).length} items)`);
  console.log(`  ${dim("Folder:")}  ${cyan(abs)}`);
  console.log(`  ${dim("Set up:")}  cd ${q} && npm install`);
  return 0;
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
}

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

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { readConfig } from "../util/config.js";
import { checkTheme } from "../lib/themeCheck.js";

const PUSH_URL = (process.env.KURUMERA_PUSH_URL || "https://themekit.kurumera.com/_push").replace(/\/+$/, "");

/**
 * `kurumera theme push` — validate, bundle, and upload the theme as a new
 * version. The platform builds it and serves a preview (see `theme preview`).
 */
export async function themePush(args: string[]): Promise<number> {
  const dir = resolve(process.cwd());
  if (!existsSync(join(dir, "theme.config.ts")) && !existsSync(join(dir, "theme.config.js"))) {
    console.error("Run `kurumera theme push` inside a theme directory.");
    return 1;
  }

  // 1) Gate on theme check (same rules the server re-runs).
  const check = checkTheme(dir);
  if (!check.passed) {
    console.error(`theme check failed (${check.errors} error(s)). Run \`kurumera theme check\` and fix them first.`);
    return 1;
  }

  const cfg = readConfig();
  if (!cfg.authToken) {
    console.error("Not signed in. Run `kurumera login` first.");
    return 1;
  }
  const store = flag(args, "--store") || cfg.defaultStore;

  // 2) Bundle the source (exclude build/vcs artifacts) with tar.
  const tarball = join(tmpdir(), `kurumera-theme-${Date.now()}.tgz`);
  const tar = spawnSync(
    "tar",
    ["-czf", tarball, "--exclude=node_modules", "--exclude=.next", "--exclude=.git", "--exclude=dist", "-C", dir, "."],
    { stdio: "inherit" },
  );
  if (tar.status !== 0 || !existsSync(tarball)) {
    console.error("Failed to bundle the theme (is `tar` available on your PATH?).");
    return 1;
  }
  const size = statSync(tarball).size;
  console.log(`▸ Uploading theme (${(size / 1024).toFixed(0)} KB)…`);

  // 3) Upload the gzip tarball as the raw body (simple, no multipart parsing).
  let res: Response;
  try {
    res = await fetch(`${PUSH_URL}/push`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.authToken}`,
        "Content-Type": "application/gzip",
        "X-Kurumera-Store": store || "",
      },
      body: readFileSync(tarball),
    });
  } catch (e) {
    console.error(`Upload failed: ${(e as Error).message}`);
    return 1;
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string; preview_url?: string };
  if (!res.ok || !data.id) {
    console.error(`Push rejected (${res.status}): ${data.error || "unknown error"}`);
    return 1;
  }

  console.log(`✓ Pushed — version ${data.id}. Building…`);
  console.log(`  Track it:  kurumera theme preview${store ? ` --store ${store}` : ""}`);
  return 0;
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
}

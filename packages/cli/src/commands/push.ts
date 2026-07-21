import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
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

  // 2) Bundle the source to stdout (run tar IN the theme dir so no absolute
  //    drive-letter paths reach tar — GNU tar treats "C:\…" as a remote host).
  const tar = spawnSync(
    "tar",
    ["-czf", "-", "--exclude=node_modules", "--exclude=.next", "--exclude=.git", "--exclude=dist", "."],
    { cwd: dir, maxBuffer: 100 * 1024 * 1024 },
  );
  if (tar.status !== 0 || !tar.stdout || !tar.stdout.length) {
    console.error("Failed to bundle the theme (is `tar` available on your PATH?).");
    if (tar.stderr) console.error(tar.stderr.toString().trim());
    return 1;
  }
  console.log(`▸ Uploading theme (${(tar.stdout.length / 1024).toFixed(0)} KB)…`);

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
      body: tar.stdout,
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

  // Wait for the build to finish so you KNOW it succeeded before publishing —
  // otherwise `theme publish` may make the previous (last-built) version live.
  // Ctrl+C is safe: the build keeps running on the server (track it with
  // `theme preview`).
  process.stdout.write("  Building");
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    let s: { status?: string; id?: string; error?: string } = {};
    try {
      const r = await fetch(`${PUSH_URL}/status?store=${encodeURIComponent(store || "")}`, {
        headers: cfg.authToken ? { Authorization: `Bearer ${cfg.authToken}` } : {},
      });
      s = (await r.json()) as typeof s;
    } catch { /* keep polling */ }
    if (s.status === "ready") {
      console.log(`\n✓ Built — version ${s.id || data.id} is ready.`);
      console.log(`  Make it live:  kurumera theme publish${store ? ` --store ${store}` : ""}`);
      return 0;
    }
    if (s.status === "failed") {
      console.error(`\n✗ Build failed: ${s.error || "see logs"}. Fix it and push again.`);
      return 1;
    }
    process.stdout.write(".");
  }
  console.log(`\n… still building — track it with \`kurumera theme preview${store ? ` --store ${store}` : ""}\`, then publish.`);
  return 0;
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
}

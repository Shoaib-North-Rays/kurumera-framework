import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readConfig } from "../util/config.js";
import { flag } from "../util/fs.js";
import { resolveAuthToken } from "../util/resolveAuthToken.js";

const DEFAULT_API_URL = "https://admin.kurumera.com/api/v1";
const PUSH_URL = (process.env.KURUMERA_PUSH_URL || "https://themekit.kurumera.com/_push").replace(/\/+$/, "");
const CHECKPOINT_INTERVAL_MS = Math.max(30_000, Number(process.env.KURUMERA_CHECKPOINT_INTERVAL_MS) || 180_000);

/**
 * Background auto-save for `theme dev`: periodically tars the working
 * directory and uploads it to a small, inert recovery slot on push-service
 * — NOT a theme push, NOT a version, NOT buildable or servable. Purely a
 * disaster-recovery snapshot for the case a workspace (e.g. an AI agent's
 * ephemeral sandbox) is destroyed before `theme push` has ever succeeded
 * even once, which today loses the edits with zero protection. Recover
 * with `kurumera theme checkpoint restore --store <slug>`.
 *
 * Deliberately silent-but-safe: any failure here (not signed in, network
 * blip, tar missing) prints at most one warning and never touches the dev
 * server's own process/exit code.
 */
function startCheckpointing(dir: string, store: string | undefined): () => void {
  let lastHash = "";
  let warned = false;
  let stopped = false;

  const tick = async () => {
    if (stopped || !store) return;
    const authToken = await resolveAuthToken().catch(() => undefined);
    if (!authToken) {
      if (!warned) { console.log("· (not signed in — auto-save checkpoints are off for this session; `kurumera login` to enable)"); warned = true; }
      return;
    }
    const tar = spawnSync(
      "tar",
      ["-czf", "-", "--exclude=node_modules", "--exclude=.next", "--exclude=.git", "--exclude=dist", "."],
      { cwd: dir, maxBuffer: 100 * 1024 * 1024 },
    );
    if (tar.status !== 0 || !tar.stdout || !tar.stdout.length) return;   // silent — a checkpoint miss isn't fatal, there'll be another in a few minutes

    const hash = createHash("sha256").update(tar.stdout).digest("hex");
    if (hash === lastHash) return;   // nothing changed since the last checkpoint — skip the upload

    try {
      const res = await fetch(`${PUSH_URL}/checkpoint`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/gzip", "X-Kurumera-Store": store },
        body: tar.stdout,
      });
      if (res.ok) {
        lastHash = hash;
        console.log(`· checkpoint saved (${new Date().toLocaleTimeString()})`);
      } else if (!warned) {
        console.log(`· checkpoint failed (HTTP ${res.status}) — will retry`);
        warned = true;
      }
    } catch {
      if (!warned) { console.log("· checkpoint failed (network) — will retry"); warned = true; }
    }
  };

  const timer = setInterval(() => { void tick(); }, CHECKPOINT_INTERVAL_MS);
  void tick();   // one immediately, don't wait a full interval for the first save
  return () => { stopped = true; clearInterval(timer); };
}

/** Run the theme in the current directory against a store's live data. */
export function themeDev(args: string[]): number {
  if (!existsSync(resolve(process.cwd(), "theme.config.ts")) &&
      !existsSync(resolve(process.cwd(), "package.json"))) {
    console.error("Run this inside a theme directory (created by `kurumera theme init`).");
    return 1;
  }

  const cfg = readConfig();
  // Use --store, else the store from `kurumera login`.
  const store = flag(args, "--store") || cfg.defaultStore;
  const token =
    flag(args, "--token") ||
    process.env.KURUMERA_STOREFRONT_TOKEN ||
    (store && cfg.stores?.[store]) ||
    cfg.token;
  // Dev convenience: resolve by store slug (X-Tenant-ID) when no token is set.
  // `--store` doubles as the tenant slug; `--tenant` overrides it explicitly.
  const tenant = flag(args, "--tenant") || (!token ? store : undefined);

  if (!token && !tenant) {
    console.error(
      "No store credential found.\n" +
        "  • Dev (your own store):  kurumera theme dev --store <slug>\n" +
        "  • With a token:          kurumera theme dev --store <slug> --token ksf_…\n" +
        "  • Or save it first:      kurumera login --store <slug> --token ksf_…",
    );
    return 1;
  }

  const apiUrl = process.env.KURUMERA_API_URL || cfg.apiUrl || DEFAULT_API_URL;

  // A freshly cloned/init'd theme has no node_modules, so `next dev` fails with
  // "'next' is not recognized". Install deps once, automatically, on first run.
  const cwd = process.cwd();
  const hasNext =
    existsSync(resolve(cwd, "node_modules", "next")) ||
    existsSync(resolve(cwd, "node_modules", ".bin", "next")) ||
    existsSync(resolve(cwd, "node_modules", ".bin", "next.cmd"));
  if (!hasNext) {
    console.log("▸ Installing theme dependencies (first run — this can take a minute)…");
    const install = spawnSync("npm", ["install"], { stdio: "inherit", shell: true, cwd });
    if (install.status !== 0) {
      console.error("\nDependency install failed. Run `npm install` in this folder, then retry `kurumera theme dev`.");
      return install.status ?? 1;
    }
  }

  const how = token ? "token" : `slug "${tenant}"`;
  console.log(`▸ Starting theme dev${store ? ` for "${store}"` : ""} (via ${how}) → http://localhost:3000`);

  // `shell: true` so it works cross-platform — and so Node 24 can spawn npm on
  // Windows (spawning npm.cmd directly throws EINVAL since a Node security fix).
  const child = spawn("npm", ["run", "dev"], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      ...(token ? { KURUMERA_STOREFRONT_TOKEN: token } : {}),
      ...(tenant ? { KURUMERA_TENANT: tenant } : {}),
      KURUMERA_API_URL: apiUrl,
    },
  });
  const stopCheckpointing = startCheckpointing(cwd, store);
  child.on("exit", (code) => { stopCheckpointing(); process.exit(code ?? 0); });
  return 0;
}

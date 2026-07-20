import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { readConfig } from "../util/config.js";
import { flag } from "../util/fs.js";

const DEFAULT_API_URL = "https://admin.kurumera.com/api/v1";

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
  child.on("exit", (code) => process.exit(code ?? 0));
  return 0;
}

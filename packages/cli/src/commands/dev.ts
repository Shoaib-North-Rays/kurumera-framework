import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { readConfig } from "../util/config.js";
import { flag, npmBin } from "../util/fs.js";

const DEFAULT_API_URL = "https://admin.kurumera.com/api/v1";

/** Run the theme in the current directory against a store's live data. */
export function themeDev(args: string[]): number {
  if (!existsSync(resolve(process.cwd(), "theme.config.ts")) &&
      !existsSync(resolve(process.cwd(), "package.json"))) {
    console.error("Run this inside a theme directory (created by `kurumera theme init`).");
    return 1;
  }

  const store = flag(args, "--store");
  const cfg = readConfig();
  const token =
    flag(args, "--token") ||
    process.env.KURUMERA_STOREFRONT_TOKEN ||
    (store && cfg.stores?.[store]) ||
    cfg.token;

  if (!token) {
    console.error(
      "No storefront token found.\n" +
        "  • Pass one:   kurumera theme dev --store <slug> --token ksf_…\n" +
        "  • Or save it: kurumera login --store <slug> --token ksf_…\n" +
        "Get a token in the dashboard → Settings → Developer.",
    );
    return 1;
  }

  const apiUrl = process.env.KURUMERA_API_URL || cfg.apiUrl || DEFAULT_API_URL;
  console.log(`▸ Starting theme dev${store ? ` for "${store}"` : ""} → http://localhost:3000`);

  const child = spawn(npmBin(), ["run", "dev"], {
    stdio: "inherit",
    env: {
      ...process.env,
      KURUMERA_STOREFRONT_TOKEN: token,
      KURUMERA_API_URL: apiUrl,
    },
  });
  child.on("exit", (code) => process.exit(code ?? 0));
  return 0;
}

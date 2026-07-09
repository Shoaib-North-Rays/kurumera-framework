import { readConfig } from "../util/config.js";

const PUSH_URL = (process.env.KURUMERA_PUSH_URL || "https://themekit.kurumera.com/_push").replace(/\/+$/, "");
const ROOT = process.env.KURUMERA_ROOT_DOMAIN || "kurumera.com";

/**
 * `kurumera theme publish` — make the pushed code theme the store's LIVE theme
 * (shoppers on <slug>.kurumera.com see it). `--off` rolls back to the visual
 * builder. This is the StoreTheme mode switch — nothing is destroyed either way.
 */
export async function themePublish(args: string[]): Promise<number> {
  const cfg = readConfig();
  if (!cfg.authToken) {
    console.error("Not signed in. Run `kurumera login` first.");
    return 1;
  }
  const store = flag(args, "--store") || cfg.defaultStore;
  if (!store) {
    console.error("Which store? Pass --store <slug>.");
    return 1;
  }
  const off = args.includes("--off");

  let res: Response;
  try {
    res = await fetch(`${PUSH_URL}/${off ? "unpublish" : "publish"}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ store }),
    });
  } catch (e) {
    console.error(`Request failed: ${(e as Error).message}`);
    return 1;
  }
  const d = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    console.error(`Failed (${res.status}): ${d.error || "unknown error"}`);
    return 1;
  }

  if (off) {
    console.log(`✓ Rolled back — "${store}" is back on the visual builder.`);
  } else {
    console.log(`✓ Published — "${store}" now serves your code theme.`);
    console.log(`  Live: https://${store}.${ROOT}`);
  }
  return 0;
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
}

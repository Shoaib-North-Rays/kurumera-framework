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
    console.log(`✓ Unpublished — "${store}" is back on the visual builder.`);
    return 0;
  }

  console.log(`✓ Published — "${store}" now serves your code theme.`);
  // Don't just claim it — confirm the live site actually responds (the store
  // container may need a few seconds to (re)start / warm from scale-to-zero).
  const liveUrl = `https://${store}.${ROOT}`;
  process.stdout.write("  Verifying it's live");
  let liveOk = false;
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const r = await fetch(liveUrl, { redirect: "manual" });
      if (r.status >= 200 && r.status < 400) { liveOk = true; break; }
    } catch { /* warming up — keep trying */ }
    process.stdout.write(".");
  }
  if (liveOk) {
    console.log(`\n✓ Live and serving — ${liveUrl}`);
  } else {
    console.log(`\n  ${liveUrl} — flipped live; give it a few seconds to warm up, then reload. Verify: kurumera theme preview --store ${store}`);
  }
  return 0;
}

/** `kurumera theme rollback` — restore the store's PREVIOUS live version. */
export async function themeRollback(args: string[]): Promise<number> {
  const cfg = readConfig();
  if (!cfg.authToken) { console.error("Not signed in. Run `kurumera login` first."); return 1; }
  const store = flag(args, "--store") || cfg.defaultStore;
  if (!store) { console.error("Which store? Pass --store <slug>."); return 1; }

  let res: Response;
  try {
    res = await fetch(`${PUSH_URL}/rollback`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ store }),
    });
  } catch (e) {
    console.error(`Request failed: ${(e as Error).message}`);
    return 1;
  }
  const d = (await res.json().catch(() => ({}))) as { error?: string; reverted?: string; version?: string };
  if (!res.ok) { console.error(`Failed (${res.status}): ${d.error || "unknown error"}`); return 1; }
  console.log(`✓ "${store}" rolled back to ${d.reverted}${d.version ? ` (${d.version})` : ""}.`);
  console.log(`  Live: https://${store}.${ROOT}`);
  return 0;
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
}

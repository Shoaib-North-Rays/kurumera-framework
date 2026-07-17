import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readConfig } from "../util/config.js";

const PUSH_URL = (process.env.KURUMERA_PUSH_URL || "https://themekit.kurumera.com/_push").replace(/\/+$/, "");
const ROOT = process.env.KURUMERA_ROOT_DOMAIN || "kurumera.com";

/**
 * `kurumera marketplace …` — the theme registry.
 *
 *   marketplace publish            Publish this theme's latest build to the registry
 *   marketplace list               Browse published themes
 *   marketplace info <theme>       Show a theme's versions
 *   marketplace install <theme>[@version] --store <slug>
 *                                  Install a registry theme into a store (and make it live)
 *
 * Publishing takes the artifact the platform already built for your dev store, so
 * `kurumera theme push` must have succeeded first. Installing copies that built
 * artifact into the target store's own version history — installs stay isolated
 * and roll back independently, exactly like a normal push.
 */
export async function marketplace(args: string[]): Promise<number> {
  const sub = args[0];
  const rest = args.slice(1);
  switch (sub) {
    case "publish": return publish(rest);
    case "list": case "ls": return list();
    case "info": return info(rest);
    case "install": case "add": return install(rest);
    case "buy": return buy(rest);
    default:
      console.error("Usage: kurumera marketplace <publish|list|info|install|buy>");
      return 1;
  }
}

async function publish(args: string[]): Promise<number> {
  const dir = resolve(process.cwd());
  const manifest = readManifest(dir);
  if (!manifest) {
    console.error("Run `kurumera marketplace publish` inside a theme directory (no theme.config found).");
    return 1;
  }
  if (!manifest.name || !manifest.version) {
    console.error("Your theme.config needs a `name` and `version` to publish.");
    return 1;
  }
  const cfg = readConfig();
  if (!cfg.authToken) { console.error("Not signed in. Run `kurumera login` first."); return 1; }
  const store = flag(args, "--store") || cfg.defaultStore;
  if (!store) { console.error("Which store's build to publish? Pass --store <slug>."); return 1; }

  const body = {
    store,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description || "",
    author: manifest.author || cfg.defaultStore || "",
  };
  const d = await post("/market/publish", cfg.authToken, body);
  if (!d.ok) { console.error(`Publish failed: ${d.error}`); return 1; }
  console.log(`✓ Published ${d.theme}@${d.version} to the marketplace.`);
  console.log(`  Install it:  kurumera marketplace install ${d.theme}@${d.version} --store <slug>`);
  return 0;
}

async function list(): Promise<number> {
  let res: Response;
  try { res = await fetch(`${PUSH_URL}/market`); } catch (e) { console.error(`Request failed: ${(e as Error).message}`); return 1; }
  const d = (await res.json().catch(() => ({}))) as { themes?: MarketTheme[] };
  const themes = d.themes || [];
  if (!themes.length) {
    console.log("No marketplace themes yet. Publish one with `kurumera marketplace publish`.");
    return 0;
  }
  console.log("Marketplace themes\n");
  for (const t of themes) {
    console.log(`  ${t.slug.padEnd(20)} ${t.name}`);
    if (t.description) console.log(`  ${" ".repeat(20)} ${t.description}`);
    console.log(`  ${" ".repeat(20)} latest ${t.latest}  ·  ${t.versions.length} version(s)  ·  ${t.installs} install(s)\n`);
  }
  console.log("Install:  kurumera marketplace install <theme> --store <slug>");
  return 0;
}

async function info(args: string[]): Promise<number> {
  const theme = args.find((a) => !a.startsWith("--"));
  if (!theme) { console.error("Which theme? kurumera marketplace info <theme>"); return 1; }
  let res: Response;
  try { res = await fetch(`${PUSH_URL}/market/info?theme=${encodeURIComponent(theme)}`); }
  catch (e) { console.error(`Request failed: ${(e as Error).message}`); return 1; }
  if (!res.ok) { console.error(`No marketplace theme "${theme}".`); return 1; }
  const d = (await res.json()) as { slug?: string; name: string; description: string; author: string; latest: string; versions: { version: string; installs?: number }[] };
  console.log(`${d.name}  (${d.slug ?? theme})`);
  if (d.description) console.log(d.description);
  if (d.author) console.log(`by ${d.author}`);
  console.log(`\nVersions (latest ${d.latest}):`);
  for (const v of d.versions.slice().reverse()) {
    console.log(`  ${v.version.padEnd(12)} ${v.installs || 0} install(s)`);
  }
  return 0;
}

async function install(args: string[]): Promise<number> {
  const cfg = readConfig();
  if (!cfg.authToken) { console.error("Not signed in. Run `kurumera login` first."); return 1; }
  const ref = args.find((a) => !a.startsWith("--"));
  if (!ref) { console.error("Which theme? kurumera marketplace install <theme>[@version] --store <slug>"); return 1; }
  const [theme, version] = ref.split("@");
  const store = flag(args, "--store") || cfg.defaultStore;
  if (!store) { console.error("Which store? Pass --store <slug>."); return 1; }
  const license = flag(args, "--license");   // required for paid themes

  const d = await post("/market/install", cfg.authToken, { store, theme, version, license });
  if (!d.ok) {
    console.error(`Install failed: ${d.error}`);
    if (/paid theme/i.test(d.error || "")) console.error(`  Buy it:  kurumera marketplace buy ${theme}`);
    return 1;
  }
  console.log(`✓ Installed ${d.theme}@${d.version} into "${d.store}" — it's now live.`);
  console.log(`  Live:      https://${d.store}.${ROOT}`);
  console.log(`  Roll back: kurumera theme rollback --store ${d.store}`);
  return 0;
}

/** Start a real Stripe checkout for a paid theme and print the payment link. */
async function buy(args: string[]): Promise<number> {
  const theme = args.find((a) => !a.startsWith("--"));
  if (!theme) { console.error("Which theme? kurumera marketplace buy <theme> [--email you@example.com]"); return 1; }
  const email = flag(args, "--email");
  let res: Response;
  try {
    res = await fetch(`${PUSH_URL}/market/checkout`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme, email }),
    });
  } catch (e) { console.error(`Request failed: ${(e as Error).message}`); return 1; }
  const d = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
  if (!d.ok || !d.url) { console.error(`Can't start checkout: ${d.error || `HTTP ${res.status}`}`); return 1; }
  console.log(`Complete your purchase of "${theme}" here:\n  ${d.url}`);
  console.log(`\nAfter paying you'll get a license key. Then install with:`);
  console.log(`  kurumera marketplace install ${theme} --store <slug> --license <key>`);
  return 0;
}

// ── helpers ──────────────────────────────────────────────────────────────────
interface MarketTheme { slug: string; name: string; description: string; author: string; latest: string; versions: string[]; installs: number }
interface Manifest { name?: string; version?: string; description?: string; author?: string }

/** Extract name/version/description/author from theme.config.{ts,js} without executing it. */
function readManifest(dir: string): Manifest | null {
  const file = ["theme.config.ts", "theme.config.js"].map((f) => join(dir, f)).find(existsSync);
  if (!file) return null;
  const src = readFileSync(file, "utf8");
  const pick = (key: string) => {
    const m = src.match(new RegExp(`\\b${key}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`));
    return m ? m[1] : undefined;
  };
  return { name: pick("name"), version: pick("version"), description: pick("description"), author: pick("author") };
}

async function post(path: string, token: string, body: unknown): Promise<any> {
  try {
    const res = await fetch(`${PUSH_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = (await res.json().catch(() => ({}))) as Record<string, any>;
    return res.ok ? { ok: true, ...d } : { ok: false, error: d.error || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
}

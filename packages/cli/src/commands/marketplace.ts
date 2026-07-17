import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { readConfig, writeConfig } from "../util/config.js";

const PUSH_URL = (process.env.KURUMERA_PUSH_URL || "https://themekit.kurumera.com/_push").replace(/\/+$/, "");
const ROOT = process.env.KURUMERA_ROOT_DOMAIN || "kurumera.com";

/** Persist a license so future install/clone can auto-supply it (keyed by theme). */
function saveLicense(theme: string, key: string): void {
  const c = readConfig();
  c.licenses = { ...c.licenses, [theme]: key };
  writeConfig(c);
}
function savedLicense(theme: string): string | undefined {
  return readConfig().licenses?.[theme];
}

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
    case "clone": return clone(rest);
    case "owns": return owns(rest);
    case "mine": return mine(rest);
    case "update": return update(rest);
    case "unpublish": case "delist": return unpublish(rest);
    default:
      console.error("Usage: kurumera marketplace <publish|list|info|install|clone|buy|owns|mine|update|unpublish>");
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
  const license = flag(args, "--license") || savedLicense(theme);   // paid themes; reuse a saved key

  const d = await post("/market/install", cfg.authToken, { store, theme, version, license });
  if (!d.ok) {
    console.error(`Install failed: ${d.error}`);
    if (/paid theme/i.test(d.error || "")) console.error(`  Buy it:  kurumera marketplace buy ${theme}`);
    return 1;
  }
  if (license) saveLicense(theme, license);   // remember it so future installs/clones don't need --license
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

/**
 * Download a theme's editable SOURCE (license-gated for paid themes) and extract
 * it locally so you can customize it and re-publish. Paid themes need --license
 * (or a saved one); free themes clone freely.
 */
async function clone(args: string[]): Promise<number> {
  const ref = args.find((a) => !a.startsWith("--"));
  if (!ref) { console.error("Which theme? kurumera marketplace clone <theme>[@version] [--dir <folder>] [--license <key>]"); return 1; }
  const [theme, version] = ref.split("@");
  const license = flag(args, "--license") || savedLicense(theme);
  const dir = flag(args, "--dir") || `my-${theme}`;
  if (existsSync(dir)) { console.error(`"${dir}" already exists — pass --dir <folder> for a fresh location.`); return 1; }

  const qs = new URLSearchParams({ theme });
  if (version) qs.set("version", version);
  if (license) qs.set("license", license);

  let res: Response;
  try { res = await fetch(`${PUSH_URL}/market/source?${qs.toString()}`); }
  catch (e) { console.error(`Request failed: ${(e as Error).message}`); return 1; }
  if (res.status === 402) {
    console.error(`"${theme}" is a paid theme — buy it, then clone with a license key.`);
    console.error(`  Buy it:  kurumera marketplace buy ${theme}`);
    return 1;
  }
  if (!res.ok) { console.error(`Clone failed: ${(await res.text().catch(() => "")) || `HTTP ${res.status}`}`); return 1; }

  // Pipe the gzipped tarball straight into `tar` (bsdtar on Windows/macOS, GNU on Linux).
  mkdirSync(dir, { recursive: true });
  const tar = spawn("tar", ["-xzf", "-", "-C", dir], { stdio: ["pipe", "inherit", "inherit"] });
  const failed = await new Promise<boolean>((resolve) => {
    tar.on("error", () => resolve(true));
    tar.on("close", (code) => resolve(code !== 0));
    res.arrayBuffer().then((b) => { tar.stdin.write(Buffer.from(b)); tar.stdin.end(); }).catch(() => resolve(true));
  });
  if (failed) { console.error("Couldn't extract the source — is `tar` installed and on your PATH?"); return 1; }

  if (license) saveLicense(theme, license);
  console.log(`✓ Cloned "${theme}"${version ? `@${version}` : ""} → ${dir}`);
  console.log(`  Set up:    cd ${dir} && npm install`);
  console.log(`  Develop:   kurumera theme dev --store <your-store>`);
  console.log(`  Re-ship:   kurumera theme push  →  kurumera marketplace publish --store <your-store>`);
  return 0;
}

/** Do you own this theme? (free ⇒ always; paid ⇒ needs a valid license). */
async function owns(args: string[]): Promise<number> {
  const theme = args.find((a) => !a.startsWith("--"));
  if (!theme) { console.error("Which theme? kurumera marketplace owns <theme>"); return 1; }
  const license = flag(args, "--license") || savedLicense(theme);
  let res: Response;
  try { res = await fetch(`${PUSH_URL}/market/owns?theme=${encodeURIComponent(theme)}${license ? `&license=${encodeURIComponent(license)}` : ""}`); }
  catch (e) { console.error(`Request failed: ${(e as Error).message}`); return 1; }
  const d = (await res.json().catch(() => ({}))) as { paid?: boolean; owned?: boolean };
  if (d.owned) console.log(`✓ You own "${theme}"${d.paid ? "" : " (it's free)"}.`);
  else console.log(`✗ You don't own "${theme}" yet — it's paid.\n  Buy it:  kurumera marketplace buy ${theme}`);
  return 0;
}

/** List the listings you've published from a store you own. */
async function mine(args: string[]): Promise<number> {
  const cfg = readConfig();
  if (!cfg.authToken) { console.error("Not signed in. Run `kurumera login` first."); return 1; }
  const store = flag(args, "--store") || cfg.defaultStore;
  if (!store) { console.error("Which store? Pass --store <slug>."); return 1; }
  let res: Response;
  try { res = await fetch(`${PUSH_URL}/market/mine?store=${encodeURIComponent(store)}`, { headers: { Authorization: `Bearer ${cfg.authToken}` } }); }
  catch (e) { console.error(`Request failed: ${(e as Error).message}`); return 1; }
  const d = (await res.json().catch(() => ({}))) as { themes?: { slug: string; name: string; price: number; currency: string; installs: number }[]; error?: string };
  if (!res.ok) { console.error(`Failed: ${d.error || `HTTP ${res.status}`}`); return 1; }
  const themes = d.themes || [];
  if (!themes.length) { console.log(`No listings published from "${store}".`); return 0; }
  console.log(`Your listings (store ${store}):\n`);
  for (const t of themes) {
    const price = t.price > 0 ? `${t.price} ${t.currency}` : "Free";
    console.log(`  ${t.slug.padEnd(20)} ${t.name}  ·  ${price}  ·  ${t.installs} install(s)`);
  }
  return 0;
}

/** Edit a listing you own (price / currency / description / tags / category). */
async function update(args: string[]): Promise<number> {
  const cfg = readConfig();
  if (!cfg.authToken) { console.error("Not signed in. Run `kurumera login` first."); return 1; }
  const theme = args.find((a) => !a.startsWith("--"));
  if (!theme) { console.error("Which theme? kurumera marketplace update <theme> [--price N] [--currency USD] [--description …] [--tags a,b] [--category …]"); return 1; }
  const body: Record<string, unknown> = { theme, store: flag(args, "--store") || cfg.defaultStore };
  const price = flag(args, "--price"); if (price !== undefined) body.price = Number(price);
  const currency = flag(args, "--currency"); if (currency) body.currency = currency;
  const description = flag(args, "--description"); if (description !== undefined) body.description = description;
  const tags = flag(args, "--tags"); if (tags !== undefined) body.tags = tags.split(",").map((x) => x.trim()).filter(Boolean);
  const category = flag(args, "--category"); if (category !== undefined) body.category = category;
  const d = await post("/market/update", cfg.authToken, body);
  if (!d.ok) { console.error(`Update failed: ${d.error}`); return 1; }
  console.log(`✓ Updated "${theme}" — live on the marketplace.`);
  return 0;
}

/** Delist a listing you own (existing installs keep working). */
async function unpublish(args: string[]): Promise<number> {
  const cfg = readConfig();
  if (!cfg.authToken) { console.error("Not signed in. Run `kurumera login` first."); return 1; }
  const theme = args.find((a) => !a.startsWith("--"));
  if (!theme) { console.error("Which theme? kurumera marketplace unpublish <theme>"); return 1; }
  const d = await post("/market/unpublish", cfg.authToken, { theme, store: flag(args, "--store") || cfg.defaultStore });
  if (!d.ok) { console.error(`Delist failed: ${d.error}`); return 1; }
  console.log(`✓ Delisted "${theme}" from the marketplace.`);
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

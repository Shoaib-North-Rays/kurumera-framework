/**
 * Theme check (P4) — validates a Kurumera theme against the contract, safety, and
 * quality rules before it can be pushed. Runs locally (Node/fs); the backend build
 * service re-runs the same rules so a tampered client can't bypass them.
 *
 * Categories: contract · security · dependencies · config · commerce · seo · env
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type Severity = "error" | "warning";
export type Category = "contract" | "security" | "dependencies" | "config" | "commerce" | "seo" | "env";

export interface Finding {
  severity: Severity;
  category: Category;
  rule: string;
  message: string;
  file?: string;
  fix?: string;
}

export interface CheckResult {
  findings: Finding[];
  errors: number;
  warnings: number;
  passed: boolean;
}

const REQUIRED_ROUTES: { name: string; file: string }[] = [
  { name: "home", file: "app/page.tsx" },
  { name: "product", file: "app/products/[handle]/page.tsx" },
  { name: "collection", file: "app/collections/[handle]/page.tsx" },
  { name: "cart", file: "app/cart/page.tsx" },
  { name: "search", file: "app/search/page.tsx" },
  { name: "page", file: "app/pages/[handle]/page.tsx" },
];

const FORBIDDEN_MODULES = [
  "fs", "node:fs", "fs/promises", "node:fs/promises",
  "child_process", "node:child_process", "net", "node:net",
  "os", "node:os", "dgram", "cluster", "worker_threads", "node:worker_threads",
  "http", "node:http", "https", "node:https", "dns", "node:dns",
];

// Deps a theme cannot use where it runs: its own server framework (Next.js is
// the server), its own sign-in (the platform owns customer accounts), a
// database (a theme has no persistent storage of its own), and native or
// browser-driving packages the sandbox cannot run.
//
// Integration SDKs — stripe, nodemailer, jsonwebtoken, the AWS SDK — are NOT
// here. A theme may run server code (route handlers, server actions) with its
// own keys from .env, so a developer can connect their own services.
const FORBIDDEN_DEPS = [
  "express", "koa", "fastify", "next-auth", "mongoose", "mongodb", "pg", "mysql",
  "mysql2", "sqlite3", "redis", "ioredis", "puppeteer", "playwright", "sharp", "bcrypt",
];

// The .env files Next.js loads in production. `theme push` uploads them; the
// platform builds and runs this store with them and keeps them out of every
// copy of the source it hands back out (pull, download, marketplace).
const DEPLOYED_ENV_FILES = [".env", ".env.production", ".env.local", ".env.production.local"];

/** Names a theme's deployed .env files define. */
function deployedEnvNames(dir: string): Set<string> {
  const names = new Set<string>();
  for (const f of DEPLOYED_ENV_FILES) {
    for (const line of read(dir, f).split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
      if (m) names.add(m[1]);
    }
  }
  return names;
}

/** A NEXT_PUBLIC_ name that reads like a secret — those are built into the browser bundle. */
const SECRET_LOOKING = /SECRET|PRIVATE|PASSWORD|PASSWD/i;

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".git", ".turbo", "public"]);

/** A file that passes the visitor's address on, by any of the accepted routes. */
const FORWARDS_VISITOR = /x-forwarded-for|visitorHeaders|forwardHeaders/i;

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function* walk(dir: string): Generator<string> {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function read(dir: string, ...parts: string[]): string {
  try { return readFileSync(join(dir, ...parts), "utf8"); } catch { return ""; }
}

export function checkTheme(dir: string): CheckResult {
  const findings: Finding[] = [];
  const add = (severity: Severity, category: Category, rule: string, message: string, extra: { file?: string; fix?: string } = {}) =>
    findings.push({ severity, category, rule, message, ...extra });

  // ── contract ───────────────────────────────────────────────────────────────
  for (const r of REQUIRED_ROUTES) {
    if (!existsSync(join(dir, ...r.file.split("/")))) {
      add("error", "contract", "route-contract", `Missing required "${r.name}" template.`,
        { file: r.file, fix: `Create ${r.file}.` });
    }
  }
  if (!existsSync(join(dir, "app", "not-found.tsx")) && !existsSync(join(dir, "app", "not-found.jsx"))) {
    add("warning", "contract", "not-found", "No custom 404 page.",
      { fix: "Add app/not-found.tsx for a branded not-found page (Next has a default otherwise)." });
  }

  // ── config ───────────────────────────────────────────────────────────────
  const cfg = read(dir, "theme.config.ts") || read(dir, "theme.config.js");
  if (!cfg) {
    add("error", "config", "theme-config", "Missing theme.config.ts at the theme root.",
      { fix: "Export a defineTheme({...}) from theme.config.ts." });
  } else {
    if (!/name\s*:/.test(cfg)) add("warning", "config", "config-name", "theme.config is missing a `name`.", { file: "theme.config.ts" });
    if (!/version\s*:/.test(cfg)) add("warning", "config", "config-version", "theme.config is missing a `version`.", { file: "theme.config.ts" });
    if (!/framework\s*:\s*['"]nextjs['"]/.test(cfg)) add("warning", "config", "config-framework", "theme.config `framework` should be 'nextjs'.", { file: "theme.config.ts" });
  }

  // ── dependencies ───────────────────────────────────────────────────────────
  const pkgRaw = read(dir, "package.json");
  if (pkgRaw) {
    let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
    try { pkg = JSON.parse(pkgRaw); } catch { add("error", "config", "package-json", "package.json is not valid JSON.", { file: "package.json" }); }
    const deps = { ...(pkg.dependencies ?? {}) };
    for (const bad of FORBIDDEN_DEPS) {
      if (deps[bad]) add("error", "dependencies", "forbidden-dependency",
        `Dependency "${bad}" isn't allowed — themes are client-safe and read data via the SDK.`,
        { file: "package.json", fix: `Remove "${bad}" from dependencies.` });
    }
    if (!deps["@kurumera/storefront"]) {
      add("warning", "dependencies", "sdk-missing", "@kurumera/storefront isn't a dependency.",
        { file: "package.json", fix: "Add @kurumera/storefront to read store data." });
    }
  }

  // ── security (source scan) ─────────────────────────────────────────────────
  // Route handlers (app/api/) and server actions are allowed: they are how a
  // theme connects its own services. They run in the same sandbox as every
  // page the theme renders, which is the boundary that matters.
  const envNames = deployedEnvNames(dir);
  for (const name of envNames) {
    if (name.startsWith("NEXT_PUBLIC_") && SECRET_LOOKING.test(name)) {
      add("warning", "env", "public-secret",
        `${name} is built into the JavaScript every visitor downloads.`,
        { fix: `Drop the NEXT_PUBLIC_ prefix and read it only in server code (a route handler, a server action or a server component).` });
    }
  }
  for (const file of walk(dir)) {
    if (!/\.(ts|tsx|js|jsx|mjs)$/.test(file)) continue;
    const rel = file.slice(dir.length + 1).replace(/\\/g, "/");
    let src = "";
    try { src = readFileSync(file, "utf8"); } catch { continue; }

    for (const m of FORBIDDEN_MODULES) {
      if (new RegExp(`(?:from\\s*|require\\(\\s*)['"]${escapeRe(m)}['"]`).test(src)) {
        add("error", "security", "no-node-apis", `Imports Node/server module "${m}".`, { file: rel, fix: "Themes must be client-safe — no Node APIs." });
        break;
      }
    }
    if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(src)) add("error", "security", "no-eval", "eval / new Function isn't allowed.", { file: rel });

    // A raw call to the platform API, and whether it understands the
    // platform's refusals.
    //
    // The endpoint path usually lives in a config module while the fetch()
    // lives elsewhere, so the per-file signal is the API base, not the path.
    //
    // It matters most for forms. Since October 2026 every store blocks senders
    // by address or email, and a blocked sender gets 403 with the reason nested
    // under `error.code` / `error.message`. Code that reads the body's TOP
    // level finds nothing there and shows its own "please try again" — hiding
    // the refusal and spending another of the sender's hourly tries. A real
    // person on a shared office or mobile network can land there.
    const platformCall = /\bfetch\s*\(/.test(src)
      && /KURUMERA_PUBLIC_API_BASE|KURUMERA_API_URL|admin\.kurumera\.com|\/storefront\//.test(src);
    if (platformCall) {
      add("warning", "security", "raw-platform-fetch",
        "Calls the platform API with fetch() instead of @kurumera/storefront.",
        { file: rel, fix: "Use the SDK — it throws KurumeraError with the response's code and message." });

      // Satisfied by naming the code, by delegating to a helper named for it,
      // or by going through the SDK's KurumeraError — all three mean somebody
      // has thought about the refusal.
      const handlesBlocked = /sender_blocked|isSenderBlocked|readFormError|KurumeraError/.test(src);
      const posts = /method:\s*['"]POST['"]/i.test(src);
      if (posts && !handlesBlocked) {
        add("warning", "security", "form-error-handling",
          "POSTs to the platform with fetch() but never checks for \"sender_blocked\".",
          { file: rel, fix: "Read error.code from the body; on sender_blocked show error.message, never a success state and never a retry." });
      }

      // A server-side call that does not say whose page it is for. Only flagged
      // where the file reads next/headers — that is what makes it certainly
      // server code; a module a client component imports runs in the browser,
      // which already carries the visitor's address and needs nothing.
      if (/from\s+["']next\/headers["']/.test(src) && !FORWARDS_VISITOR.test(src)) {
        add("warning", "security", "visitor-not-forwarded",
          "Calls the platform from the server without forwarding the visitor's address.",
          { file: rel, fix: "Add the request's x-forwarded-for and cf-connecting-ip, as received — `...(await visitorHeaders())` from lib/kurumera.ts." });
      }
    }

    // The theme's own SDK client. Every server-rendered page goes through it, so
    // this is the one place that decides whether the platform can tell visitors
    // apart — and with it, whether one crawler can rate-limit every store
    // rendered on the same server.
    if (rel === "lib/kurumera.ts" && /createKurumeraClient\s*\(/.test(src) && !/forwardHeaders/.test(src)) {
      add("warning", "security", "visitor-not-forwarded",
        "getStore() does not forward the visitor's address, so every visitor shares one rate limit.",
        { file: rel, fix: "Pass forwardHeaders: { \"x-forwarded-for\": h.get(\"x-forwarded-for\"), \"cf-connecting-ip\": h.get(\"cf-connecting-ip\") } — or run `kurumera theme upgrade --merge --apply`." });
    }

    // Environment variables. The platform provides KURUMERA_* and NODE_ENV;
    // everything else comes from the theme's own .env files. In the browser
    // only NEXT_PUBLIC_* exist — Next.js inlines those at build time.
    const clientFile = /^\s*['"]use client['"]/m.test(src);
    const seen = new Set<string>();
    for (const em of src.match(/process\.env\.([A-Za-z0-9_]+)/g) ?? []) {
      const name = em.split(".").pop()!;
      if (name.startsWith("KURUMERA_") || name === "NODE_ENV" || seen.has(name)) continue;
      seen.add(name);
      if (clientFile && !name.startsWith("NEXT_PUBLIC_")) {
        add("warning", "env", "env-in-browser",
          `Reads process.env.${name} in a "use client" file — it is undefined in the browser.`,
          { file: rel, fix: `Read it in server code and pass the value down, or rename it NEXT_PUBLIC_${name} if it is safe for every visitor to see.` });
      } else if (!envNames.has(name)) {
        add("warning", "env", "env-access",
          `Reads process.env.${name}, which no deployed .env file sets — it will be undefined on the store.`,
          { file: rel, fix: `Add ${name}=… to .env.production (or .env), then push.` });
      }
    }
  }

  // ── commerce UX ────────────────────────────────────────────────────────────
  const product = read(dir, "app", "products", "[handle]", "page.tsx");
  if (product) {
    if (!/price|Price/.test(product)) add("warning", "commerce", "product-price", "The product template doesn't seem to show a price.", { file: "app/products/[handle]/page.tsx", fix: "Render the product price on the PDP." });
    if (!/add[\s-]?to[\s-]?cart|addLine|AddToCart/i.test(product)) add("warning", "commerce", "add-to-cart", "The product template has no visible add-to-cart.", { file: "app/products/[handle]/page.tsx", fix: "Add an Add-to-Cart control." });
  }

  // ── seo ────────────────────────────────────────────────────────────────────
  const layout = read(dir, "app", "layout.tsx");
  if (layout && !/export const metadata|export function generateMetadata|export async function generateMetadata/.test(layout)) {
    add("warning", "seo", "metadata", "Root layout exports no metadata (title/description).", { file: "app/layout.tsx", fix: "Export `metadata` from app/layout.tsx." });
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  return { findings, errors, warnings: findings.length - errors, passed: errors === 0 };
}

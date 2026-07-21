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

// Deps that signal server code / native modules — not allowed in a client-safe theme.
const FORBIDDEN_DEPS = [
  "express", "koa", "fastify", "next-auth", "mongoose", "mongodb", "pg", "mysql",
  "mysql2", "sqlite3", "redis", "ioredis", "nodemailer", "aws-sdk", "@aws-sdk/client-s3",
  "puppeteer", "playwright", "sharp", "bcrypt", "jsonwebtoken", "stripe",
];

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".git", ".turbo", "public"]);

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
  if (existsSync(join(dir, "app", "api"))) {
    add("error", "security", "no-server-routes", "Custom API routes (app/api/) aren't allowed.",
      { fix: "Remove app/api/ — read data through @kurumera/storefront." });
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
    if (/^\s*['"]use server['"]/m.test(src)) add("error", "security", "no-server-actions", `"use server" isn't allowed.`, { file: rel });
    if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(src)) add("error", "security", "no-eval", "eval / new Function isn't allowed.", { file: rel });

    const seen = new Set<string>();
    for (const em of src.match(/process\.env\.([A-Z0-9_]+)/g) ?? []) {
      const name = em.split(".").pop()!;
      if (name.startsWith("KURUMERA_") || name === "NODE_ENV" || seen.has(name)) continue;
      seen.add(name);
      add("warning", "env", "env-access", `Reads process.env.${name} — only KURUMERA_* is available at runtime.`, { file: rel });
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

/**
 * Theme check — validates a Kurumera theme against the P0 contract + safety rules
 * before it can be pushed. Runs locally (Node/fs); the backend build service will
 * re-run the same rules server-side so a tampered client can't bypass them.
 *
 * Rules:
 *  - route contract: every required template exists (doc §17)
 *  - constrained bundle: no server code, Node APIs, custom API routes, eval
 *  - env: only KURUMERA_* is available at runtime
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type Severity = "error" | "warning";

export interface Finding {
  severity: Severity;
  rule: string;
  message: string;
  file?: string;
}

export interface CheckResult {
  findings: Finding[];
  errors: number;
  warnings: number;
  passed: boolean;
}

/** Required templates → their app-router file (doc §17 theme contract). */
const REQUIRED_ROUTES: { name: string; file: string }[] = [
  { name: "home", file: "app/page.tsx" },
  { name: "product", file: "app/products/[handle]/page.tsx" },
  { name: "collection", file: "app/collections/[handle]/page.tsx" },
  { name: "cart", file: "app/cart/page.tsx" },
  { name: "search", file: "app/search/page.tsx" },
  { name: "page", file: "app/pages/[handle]/page.tsx" },
];

/** Node/server modules a client-safe theme must never import. */
const FORBIDDEN_MODULES = [
  "fs", "node:fs", "fs/promises", "node:fs/promises",
  "child_process", "node:child_process", "net", "node:net",
  "os", "node:os", "dgram", "cluster", "worker_threads", "node:worker_threads",
  "http", "node:http", "https", "node:https", "dns", "node:dns",
];

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".git", ".turbo", "public"]);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

export function checkTheme(dir: string): CheckResult {
  const findings: Finding[] = [];
  const add = (severity: Severity, rule: string, message: string, file?: string) =>
    findings.push({ severity, rule, message, file });

  // theme.config
  if (!existsSync(join(dir, "theme.config.ts")) && !existsSync(join(dir, "theme.config.js"))) {
    add("error", "theme-config", "Missing theme.config.ts at the theme root.");
  }

  // route contract
  for (const r of REQUIRED_ROUTES) {
    if (!existsSync(join(dir, ...r.file.split("/")))) {
      add("error", "route-contract", `Missing required "${r.name}" template — expected ${r.file}.`);
    }
  }

  // custom backend routes are forbidden
  if (existsSync(join(dir, "app", "api"))) {
    add("error", "no-server-routes", "Custom API routes (app/api/) aren't allowed — themes read data through the SDK only.");
  }

  // source scan
  for (const file of walk(dir)) {
    if (!/\.(ts|tsx|js|jsx|mjs)$/.test(file)) continue;
    const rel = file.slice(dir.length + 1).replace(/\\/g, "/");
    let src = "";
    try { src = readFileSync(file, "utf8"); } catch { continue; }

    for (const m of FORBIDDEN_MODULES) {
      const re = new RegExp(`(?:from\\s*|require\\(\\s*)['"]${escapeRe(m)}['"]`);
      if (re.test(src)) {
        add("error", "no-node-apis", `Imports Node/server module "${m}" — themes must be client-safe.`, rel);
        break;
      }
    }
    if (/^\s*['"]use server['"]/m.test(src)) {
      add("error", "no-server-actions", `"use server" (server actions) isn't allowed in a theme.`, rel);
    }
    if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(src)) {
      add("error", "no-eval", "eval / new Function isn't allowed.", rel);
    }
    const seen = new Set<string>();
    for (const em of src.match(/process\.env\.([A-Z0-9_]+)/g) ?? []) {
      const name = em.split(".").pop()!;
      if (name.startsWith("KURUMERA_") || name === "NODE_ENV" || seen.has(name)) continue;
      seen.add(name);
      add("warning", "env-access", `Reads process.env.${name} — only KURUMERA_* is available at runtime.`, rel);
    }
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  return { findings, errors, warnings: findings.length - errors, passed: errors === 0 };
}

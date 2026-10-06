/**
 * What the theme looked like the moment it was scaffolded.
 *
 * `theme upgrade` has one hard question to answer for every file: did the
 * DEVELOPER change this, or did the TEMPLATE move on? Without an answer it can
 * only overwrite (destroying work) or skip (delivering nothing).
 *
 * The usual way to answer it is a three-way merge against the old template,
 * which means keeping every past template around and knowing which one a theme
 * came from. A hash per file at scaffold time answers the same question exactly,
 * with one small JSON file and no history to host: a file whose hash still
 * matches its baseline has not been touched since `init`, so replacing it is
 * safe. A file whose hash differs is the developer's, and is never written over.
 *
 * It also distinguishes a file the developer DELETED from one the template has
 * only just added — the baseline lists the first and not the second — so an
 * upgrade cannot resurrect something somebody removed on purpose.
 *
 * Lives at .kurumera/baseline.json inside the theme. It is pushed with the
 * theme (push only excludes node_modules, .next, .git and dist), so a developer
 * who pulls a version back gets the baseline with it and can still upgrade.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

export const BASELINE_DIR = ".kurumera";
export const BASELINE_FILE = "baseline.json";

/** Build artefacts and local-only files a template never meaningfully owns. */
const SKIP = new Set([
  "node_modules", ".next", "dist", ".git", ".turbo", ".DS_Store", BASELINE_DIR,
]);

export interface Baseline {
  /** The CLI that scaffolded (or last upgraded) this theme. */
  cli: string;
  /** ISO date of that scaffold/upgrade. */
  at: string;
  /** Relative POSIX path -> sha256 of the file as the template shipped it. */
  files: Record<string, string>;
}

export function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Every file in a tree, as POSIX-relative paths, skipping build artefacts. */
export function walk(root: string, dir = root, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.endsWith(".tsbuildinfo")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(root, p, out);
    else out.push(relative(root, p).split("\\").join("/"));
  }
  return out;
}

/** Hash every file of a tree, keyed by relative path. */
export function hashTree(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rel of walk(root)) {
    try { out[rel] = sha256(readFileSync(join(root, rel))); } catch { /* unreadable, skip */ }
  }
  return out;
}

export function readBaseline(themeDir: string): Baseline | null {
  try {
    const raw = readFileSync(join(themeDir, BASELINE_DIR, BASELINE_FILE), "utf8");
    const b = JSON.parse(raw) as Baseline;
    return b && typeof b === "object" && b.files ? b : null;
  } catch {
    return null;
  }
}

export function writeBaseline(themeDir: string, cli: string, files: Record<string, string>): void {
  const dir = join(themeDir, BASELINE_DIR);
  mkdirSync(dir, { recursive: true });
  const body: Baseline = { cli, at: new Date().toISOString(), files };
  writeFileSync(join(dir, BASELINE_FILE), JSON.stringify(body, null, 2) + "\n");
}

/** This CLI's own version, for stamping the baseline. */
export function cliVersion(here: string): string {
  // dist/util/baseline.js -> <pkg>/package.json
  for (const rel of ["../../package.json", "../../../package.json"]) {
    try {
      const pkg = JSON.parse(readFileSync(join(here, rel), "utf8"));
      if (pkg?.name === "@kurumera/cli" && pkg.version) return String(pkg.version);
    } catch { /* try the next */ }
  }
  return "unknown";
}

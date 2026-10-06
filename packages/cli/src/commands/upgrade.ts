import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { flag } from "../util/fs.js";
import { cliVersion, hashTree, readBaseline, sha256, walk, writeBaseline } from "../util/baseline.js";

const TTY = process.stdout.isTTY;
const paint = (c: string, s: string) => (TTY ? `\x1b[${c}m${s}\x1b[0m` : s);
const green = (s: string) => paint("32", s);
const yellow = (s: string) => paint("33", s);
const cyan = (s: string) => paint("36", s);
const dim = (s: string) => paint("2", s);

/**
 * Files the template ships but a theme OWNS once it exists. Overwriting any of
 * these would replace the theme's own identity with the starter's.
 */
const NEVER_WRITE = new Set([
  "theme.config.ts",   // the theme's name, version and routes
  "theme.config.js",
  "package.json",      // its name and its dependency ranges — reported, never written
  "package-lock.json",
  ".env.local",
  ".env",
]);

/** Locate the template, exactly as `theme init` does. */
function baseThemeDir(): string {
  if (process.env.KURUMERA_BASE_THEME) return process.env.KURUMERA_BASE_THEME;
  const here = fileURLToPath(import.meta.url);
  const bundled = resolve(here, "../../../template");
  if (existsSync(bundled)) return bundled;
  return resolve(here, "../../../../../base-theme");
}

type Verdict = "add" | "update" | "yours" | "deleted" | "unknown" | "same";

interface Row { rel: string; verdict: Verdict }

/**
 * `kurumera theme upgrade` — bring a theme's base files up to this CLI's
 * template without touching the developer's own work.
 *
 * `theme pull` is a download of what was pushed, and `theme init` only ever
 * copies the template once, so a theme scaffolded on an older CLI never sees a
 * later fix that shipped in the template rather than in an npm package. This is
 * the missing half: it replays those template changes onto an existing theme.
 *
 * Safe by construction. It reports by default and writes only with --apply; it
 * never deletes; it never overwrites a file the developer has edited; and it
 * leaves theme.config and package.json alone, because those carry the theme's
 * identity rather than the starter's.
 */
export function themeUpgrade(args: string[]): number {
  const dir = resolve(flag(args, "--dir") || process.cwd());
  const apply = args.includes("--apply");

  if (!existsSync(join(dir, "package.json"))) {
    console.error(`No package.json in ${dir} — run this inside a theme, or pass --dir <folder>.`);
    return 1;
  }
  const src = baseThemeDir();
  if (!existsSync(src)) {
    console.error(`Base theme template not found at:\n  ${src}\nSet KURUMERA_BASE_THEME to its path.`);
    return 1;
  }

  const version = cliVersion(dirname(fileURLToPath(import.meta.url)));
  const template = hashTree(src);
  const baseline = readBaseline(dir);

  const rows: Row[] = [];
  for (const rel of Object.keys(template).sort()) {
    if (NEVER_WRITE.has(rel)) continue;
    const themeFile = join(dir, rel);
    const scaffolded = baseline?.files[rel];

    if (!existsSync(themeFile)) {
      // In the baseline but gone from the theme means somebody deleted it on
      // purpose. Re-adding it would undo a decision, so it is only reported.
      rows.push({ rel, verdict: scaffolded ? "deleted" : "add" });
      continue;
    }
    const current = sha256(readFileSync(themeFile));
    if (current === template[rel]) { rows.push({ rel, verdict: "same" }); continue; }
    if (scaffolded && current === scaffolded) { rows.push({ rel, verdict: "update" }); continue; }
    rows.push({ rel, verdict: scaffolded ? "yours" : "unknown" });
  }

  const of = (v: Verdict) => rows.filter((r) => r.verdict === v);
  const add = of("add"), update = of("update"), yours = of("yours");
  const unknown = of("unknown"), deleted = of("deleted");

  console.log(`\nTheme:    ${cyan(dir)}`);
  console.log(`Template: ${dim(src)}  ${dim(`(CLI ${version})`)}`);
  console.log(baseline
    ? dim(`Baseline: scaffolded with CLI ${baseline.cli} on ${baseline.at.slice(0, 10)}\n`)
    : yellow("Baseline: none — this theme predates upgrade tracking.\n"));

  if (!baseline && unknown.length) {
    console.log(yellow("Without a baseline I cannot tell your edits from template changes,"));
    console.log(yellow("so every differing file is left alone and listed for you to review.\n"));
  }

  const list = (label: string, rs: Row[], colour = (s: string) => s) => {
    if (!rs.length) return;
    console.log(colour(`${label} (${rs.length})`));
    rs.forEach((r) => console.log(`  ${r.rel}`));
    console.log("");
  };

  list("New in the template — will be added", add, green);
  list("Untouched since you scaffolded — will be updated", update, green);
  list("You edited these — left alone", yours, yellow);
  list("Differ, and no baseline says who changed them — left alone", unknown, yellow);
  list("In the template but you deleted them — left alone", deleted, dim);

  const writes = add.length + update.length;
  if (!writes && !yours.length && !unknown.length) {
    console.log(green("✓ Already up to date with this CLI's template."));
    if (!baseline && apply) {
      writeBaseline(dir, version, template);
      console.log(dim("  Recorded a baseline, so the next upgrade can tell your edits apart."));
    }
    return 0;
  }

  if (!apply) {
    console.log(`${writes} file(s) would change. Nothing has been written.`);
    console.log(`Run again with ${cyan("--apply")} to do it.`);
    if (yours.length || unknown.length) {
      console.log(dim("The files left alone are yours to merge by hand; compare them against"));
      console.log(dim(`the template at ${src}`));
    }
    return 0;
  }

  for (const { rel } of [...add, ...update]) {
    const to = join(dir, rel);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(src, rel), to);
  }

  // Record the template as it is NOW, including the files left alone: the next
  // upgrade should compare against this template, not the original scaffold,
  // or it would offer the same changes again forever.
  writeBaseline(dir, version, template);

  console.log(green(`✓ Updated ${writes} file(s) to CLI ${version}.`));
  reportDependencies(dir, src);
  if (yours.length || unknown.length) {
    console.log(`\n${yellow("Left alone:")} ${yours.length + unknown.length} file(s) you have edited.`);
    console.log(dim(`Compare them against ${src} if you want the template's version.`));
  }
  console.log(`\n  ${dim("Then:")}  npm install && kurumera theme check`);
  return 0;
}

/**
 * package.json is never written — its name and dependency ranges belong to the
 * theme — but a template whose packages moved on is worth saying out loud,
 * because `npm install` alone will not widen a range the theme pinned below it.
 */
function reportDependencies(dir: string, src: string): void {
  const read = (p: string) => {
    try { return JSON.parse(readFileSync(join(p, "package.json"), "utf8")); } catch { return null; }
  };
  const mine = read(dir), theirs = read(src);
  if (!mine || !theirs) return;
  const diffs: string[] = [];
  for (const field of ["dependencies", "devDependencies"] as const) {
    for (const [name, want] of Object.entries(theirs[field] || {})) {
      const have = (mine[field] || {})[name];
      if (have !== want) diffs.push(`  ${name}: ${have || dim("(missing)")} → ${want}  ${dim(`[${field}]`)}`);
    }
  }
  if (!diffs.length) return;
  console.log(`\n${yellow("package.json was not touched")}, but the template now asks for:`);
  diffs.forEach((d) => console.log(d));
  console.log(dim("  Update these yourself if you want them."));
}

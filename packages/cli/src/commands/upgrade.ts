import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { flag } from "../util/fs.js";
import { cliVersion, hashTree, readBaseline, repairBaseline, sha256, writeBaseline } from "../util/baseline.js";
import { formatStat, unifiedDiff } from "../util/diff.js";
import { dependsOn, packageImports } from "../util/imports.js";
import { baseTemplateFor, detectBaseVersion } from "../util/baseTemplate.js";
import { hasConflicts, merge3, tooDiverged } from "../util/merge.js";

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

/** New files withheld because what they import is not in place yet. */
interface Blocked { willAdd: Row[]; blocked: string[]; needsMerge: boolean; needsDeps: boolean }

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

  // Validated before any work or output: `--from <this version>` names the
  // template itself as the starting point, so every merge finds nothing to
  // apply and reports success. Refuse it rather than let it look like it worked.
  if (flag(args, "--from") === version) {
    console.error(`--from ${version} is this CLI's own template, so there would be nothing to merge.`);
    console.error("Pass the version that SCAFFOLDED the theme, or let me work it out:");
    console.error("  kurumera theme upgrade --merge --from auto --apply");
    return 1;
  }

  const template = hashTree(src);
  // Baselines written by 0.15–0.19 record files those runs never put in the
  // theme, which the report then blames on the developer. Dropped before
  // anything is judged.
  const repair = repairBaseline(dir, readBaseline(dir));
  const baseline = repair.baseline;

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

  if (repair.dropped.length) {
    console.log(yellow(`A baseline written by CLI ${readBaseline(dir)?.cli} recorded ${repair.dropped.length} file(s) this theme never had.`));
    console.log(dim("Earlier runs withheld them and then recorded them anyway, so they were being"));
    console.log(dim("reported as files you had deleted. Ignoring those entries:\n"));
    repair.dropped.forEach((r) => console.log(dim(`  ${r}`)));
    console.log(dim(`\n  ${apply ? "The corrected baseline is being written now." : "Run with --apply to correct the baseline."}\n`));
  }

  if (!baseline && unknown.length) {
    console.log(yellow("Without a baseline I cannot tell your edits from template changes,"));
    console.log(yellow("so every differing file is left alone and listed for you to review.\n"));
  }

  const wantsMerge = args.includes("--merge");
  // The base of a three-way merge is the template a theme was scaffolded from.
  // A theme with a baseline records it; an older theme does not, and --from is
  // how its developer names it. Naming it is also consent, which is why --from
  // unlocks the `unknown` files a bare --merge deliberately leaves alone.
  const from = flag(args, "--from");

  let baseVersion = from || baseline?.cli || "";
  if (from === "auto") {
    process.stdout.write(dim("Working out which CLI scaffolded this theme… "));
    const guess = detectBaseVersion(hashTree(dir), template, {
      exclude: version,
      onProgress: (v) => process.stdout.write(dim(`${v} `)),
    });
    if (!guess || !guess.matched) {
      console.log("");
      console.error("Could not work it out — no published template matches this theme's files.");
      console.error("Name it yourself with --from <cli version>, or merge by hand with --diff.");
      return 1;
    }
    baseVersion = guess.version;
    const fit = guess.matched / Math.max(guess.total, 1);
    console.log("");
    // Stated as a confidence, not a fact. A heavily customised theme matches
    // its own scaffold poorly, and a weak best-of-a-bad-lot answer presented
    // as "✓ Scaffolded with" sends somebody debugging the merge instead of
    // the base.
    if (fit >= 0.6) {
      console.log(`${green(`✓ Scaffolded with CLI ${baseVersion}`)} ${dim(`(${guess.matched} of ${guess.total} template files still match)`)}\n`);
    } else {
      console.log(yellow(`Best guess: CLI ${baseVersion} — but only ${guess.matched} of ${guess.total} template files match it.`));
      console.log(dim("That is a weak fit, so treat the merge below as a first pass rather than the truth."));
      console.log(dim("If you know the real version, pass it: --from <cli version>.\n"));
    }
  }
  const mergeable = from ? [...yours, ...unknown] : yours;
  const showDiff = args.includes("--diff");
  const only = flag(args, "--diff");          // --diff <path> narrows to one file

  const readIf = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

  /** The edited files this run will not bring forward, given what it merged. */
  const staleAfter = (landed: Set<string>) =>
    new Set([...yours, ...unknown].map((r) => r.rel).filter((r) => !landed.has(r)));

  /**
   * Packages whose range the template raised and this run leaves alone. A new
   * file importing one of these cannot compile: the symbol it wants only
   * exists in the newer version. `--deps` moves the range, which clears them.
   */
  const stalePackages = (): Map<string, string> => {
    const out = new Map<string, string>();
    if (args.includes("--deps")) return out;
    const read = (p: string) => {
      try { return JSON.parse(readFileSync(join(p, "package.json"), "utf8")); } catch { return null; }
    };
    const mine = read(dir), theirs = read(src);
    if (!mine || !theirs) return out;
    for (const field of ["dependencies", "devDependencies"] as const) {
      for (const [name, want] of Object.entries(theirs[field] || {})) {
        const have = (mine[field] || {})[name];
        if (have !== want) out.set(name, `${want}, you have ${have || "nothing"}`);
      }
    }
    return out;
  };

  /** The exact command that would unblock the withheld files. */
  const remedy = (needsMerge: boolean, needsDeps: boolean) => [
    "kurumera theme upgrade",
    needsMerge ? `--merge${baseline ? "" : " --from auto"}` : "",
    needsDeps ? "--deps" : "",
    "--apply",
  ].filter(Boolean).join(" ");

  const reportBlocked = (b: Blocked, verb: string) => {
    if (!b.blocked.length) return;
    console.log(`\n${yellow(`Not added — ${verb} stop the theme compiling as it stands:`)}`);
    b.blocked.forEach((line) => console.log(line));
    console.log(dim(`  Bring what they need forward first:\n  ${remedy(b.needsMerge, b.needsDeps)}`));
  };

  /**
   * A new file is only useful once something mounts it, and what mounts it is
   * usually app/layout.tsx or a page — exactly the files an upgrade leaves
   * alone. Report that, because otherwise the feature installs inert and the
   * command still prints a tick.
   */
  /** new file -> the left-alone files whose template version mounts it. */
  const wiringFor = (added: Row[], landed: Set<string>): Map<string, string[]> => {
    const addedPaths = new Set(added.map((r) => r.rel));
    const known = new Set(Object.keys(template));
    const out = new Map<string, string[]>();
    for (const { rel } of [...yours, ...unknown]) {
      if (landed.has(rel)) continue;                       // merged: the wiring came with it
      const wants = dependsOn(readIf(join(src, rel)), rel, known);
      const mine = dependsOn(readIf(join(dir, rel)), rel, known);
      for (const dep of wants) {
        if (!addedPaths.has(dep) || mine.includes(dep)) continue;
        out.set(dep, [...(out.get(dep) || []), rel]);
      }
    }
    return out;
  };

  // Reported per NEW file, because the question a developer has is "I just got
  // Analytics.tsx — why is nothing happening?", and the answer is the list of
  // their own files that have to mount it.
  const reportWiring = (added: Row[], landed: Set<string>) => {
    const wiring = wiringFor(added, landed);
    if (!wiring.size) return;
    console.log(`\n${yellow("Added, but inert until you wire them in:")}`);
    for (const [dep, hosts] of wiring) {
      console.log(`  ${dep}`);
      console.log(dim(`    the template mounts it in: ${hosts.join(", ")}`));
      console.log(dim(`    see how:  kurumera theme upgrade --diff ${hosts[0]}`));
    }
    console.log(dim(`  Or have it merged in:  ${remedy(true, false)}`));
  };

  const list = (label: string, rs: Row[], colour = (s: string) => s) => {
    if (!rs.length) return;
    console.log(colour(`${label} (${rs.length})`));
    for (const r of rs) {
      const mine = readIf(join(dir, r.rel));
      const theirs = readIf(join(src, r.rel));
      // A stat on every line, so the list alone answers "is this a comment or a
      // rewrite?" — the question that made a bare filename useless.
      const stat = r.verdict === "deleted" ? "" : formatStat(mine, theirs);
      console.log(`  ${r.rel}${stat ? `  ${stat}` : ""}`);
      if (!showDiff || (only && only !== r.rel) || r.verdict === "deleted") continue;
      const patch = unifiedDiff(mine, theirs, {
        fromLabel: `${r.rel}  (yours)`,
        toLabel: `${r.rel}  (template, CLI ${version})`,
      });
      // Indented two spaces so a patch reads as belonging to the file above it.
      if (patch) console.log(patch.split("\n").map((l) => `  ${l}`).join("\n") + "\n");
    }
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
    // Files being current does not make the ranges current, and this is the
    // state a developer is in when they come back to run --deps on its own.
    reportDependencies(dir, src, apply && args.includes("--deps"));
    return 0;
  }

  if (!apply) {
    // Predict what --apply would do, including the merge if it was asked for,
    // so the dry run is the whole story and not a cheerful subset of it.
    const wouldMerge = new Set(wantsMerge && baseVersion ? mergeable.map((r) => r.rel) : []);
    const prediction = partitionAdds(add, src, template, staleAfter(wouldMerge), stalePackages());
    const { willAdd } = prediction;
    const would = willAdd.length + update.length;
    console.log(`${would} file(s) would change. Nothing has been written.`);
    reportBlocked(prediction, "what they import would");
    reportWiring(willAdd, wouldMerge);
    // Only offer the plain --apply when it would actually do something; after a
    // blocked report it is the wrong command and the remedy above is the right one.
    if (would) console.log(`\nRun again with ${cyan("--apply")} to do it.`);
    if (yours.length || unknown.length) {
      console.log(dim("\nSee exactly what changed:  kurumera theme upgrade --diff"));
      console.log(dim("Or one file:               kurumera theme upgrade --diff app/layout.tsx"));
      if (!prediction.blocked.length) {
        console.log(dim(`Merge them in for me:      ${remedy(true, false)}`));
      }
    }
    return 0;
  }

  // Merge BEFORE adding, so the decision below about which new files are safe
  // to add is made against the files that actually landed, not a guess.
  //
  // Three-way merge for the files the developer edited. Without this an upgrade
  // can only replace or skip, and the file most likely to need the template's
  // fix is exactly the one somebody has already touched.
  const mergedClean: string[] = [];
  const mergedConflicted: string[] = [];
  const mergeSkipped: string[] = [];
  const mergedNoop: string[] = [];
  const mergeNothingToDo: string[] = [];
  const mergeTooDiverged: string[] = [];
  const unresolved: string[] = [];
  const originals = new Map<string, string>();

  // `--take <path>` replaces one of the developer's files with the template's,
  // wholesale. It exists because a merge is powerless when the template has
  // not changed the file since the base: the only two possible answers are
  // "keep yours" and "take the template's", and the second has to be askable.
  // Repeatable, never implied, and never applied to a file the theme owns.
  const takes = args
    .flatMap((a, i) => (a === "--take" && args[i + 1] && !args[i + 1].startsWith("--") ? [args[i + 1]] : []))
    .map((p) => p.replace(/\\/g, "/"));
  const taken: string[] = [];
  const takeFailed: string[] = [];
  if (apply) {
    for (const rel of takes) {
      if (NEVER_WRITE.has(rel)) { takeFailed.push(`${rel}  ${dim("(the theme owns this file)")}`); continue; }
      if (!template[rel]) { takeFailed.push(`${rel}  ${dim("(not in this CLI's template)")}`); continue; }
      const to = join(dir, rel);
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(join(src, rel), to);
      taken.push(rel);
    }
  }
  if (wantsMerge && mergeable.length) {
    const base = baseVersion ? baseTemplateFor(baseVersion) : null;
    if (!base) {
      console.log(yellow(baseVersion
        ? `
Could not fetch the template for CLI ${baseVersion} to merge against.`
        : `
Cannot merge: no baseline, so I do not know which template this theme started from.`));
      console.log(dim(baseVersion
        ? "  Your edited files were left alone. Check the network, or merge by hand with --diff."
        : "  Let me work it out:  kurumera theme upgrade --merge --from auto --apply"));
    } else {
      for (const { rel } of mergeable) {
        // A file still carrying markers from a previous run is not in either
        // side's shape, so merging into it would nest one conflict inside
        // another. It is also already breaking the build, so say so loudly.
        if (hasConflicts(readIf(join(dir, rel)))) { unresolved.push(rel); continue; }

        // Each file is merged from the version IT was last brought forward
        // from, which is what stops an already-delivered change being offered
        // again on every later run.
        const per = baseline?.syncedFrom?.[rel];
        const basePath = per && per !== baseVersion
          ? join(baseTemplateFor(per) || base, rel)
          : join(base, rel);
        // Absent from the old template means there is no common ancestor, so a
        // merge would be a guess dressed up as a result. Say so instead.
        if (!existsSync(basePath)) {
          mergeSkipped.push(`${rel}  ${dim(`(did not exist in CLI ${baseVersion})`)}`);
          continue;
        }
        const mine = readFileSync(join(dir, rel), "utf8");
        originals.set(rel, mine);                 // so a merge can be rolled back
        const baseText = readFileSync(basePath, "utf8");
        const theirText = readFileSync(join(src, rel), "utf8");

        // The template has not touched this file since the base, so there is
        // nothing for a merge to carry across — any difference is the
        // developer's own edit. Reporting this as "already matched the
        // template" was wrong and read as a contradiction against the same
        // run's "+25 -54". It is called out separately, because the remedy is
        // not a better merge: it is --take, or nothing.
        if (baseText.replace(/\r\n/g, "\n") === theirText.replace(/\r\n/g, "\n")) {
          if (mine.replace(/\r\n/g, "\n") !== theirText.replace(/\r\n/g, "\n")) mergeNothingToDo.push(rel);
          else mergedNoop.push(rel);
          continue;
        }
        // Refused before it is attempted when the file has been rewritten
        // rather than edited: the base no longer provides real anchors, so the
        // template's hunks would land in positions that only look plausible.
        const drift = tooDiverged(baseText, mine);
        if (drift.too) {
          mergeTooDiverged.push(`${rel}  ${dim(`(you have rewritten ${Math.round(drift.pct * 100)}% of it)`)}`);
          continue;
        }
        const result = merge3(baseText, mine, theirText);
        if (!result.ok) {
          mergeSkipped.push(`${rel}  ${dim("(too large to merge safely)")}`);
          continue;
        }
        if (process.env.KURUMERA_DEBUG_MERGE) {
          console.error(`DBG merge ${rel} base=${basePath} out=${result.merged.split("\n").length} conflicts=${result.conflicts}`);
        }
        // A merge that changed nothing is not a merge, and counting it as one
        // is how a wrong base reported "✓ Merged 22 file(s)" having delivered
        // nothing at all. Tracked separately so the summary can say so.
        if (result.merged === mine) { mergedNoop.push(rel); continue; }
        writeFileSync(join(dir, rel), result.merged);
        (result.conflicts ? mergedConflicted : mergedClean).push(rel);
      }
    }
  }

  // A file is stale if the theme's copy is older than the template's and this
  // run did not bring it forward. Adding a new file that imports a stale one
  // breaks the build on a file the developer never asked for, so those adds are
  // skipped rather than written. This is the CouponField/cart-client case.
  const landed = new Set([...mergedClean, ...mergedConflicted]);
  const adds = partitionAdds(add, src, template, staleAfter(landed), stalePackages());
  const { willAdd } = adds;

  // A merge can carry across an import of a file this same run refused to add
  // — reported as "CouponField withheld, then referenced anyway". The two
  // decisions contradict, and the result does not build, so the merge is
  // rolled back for that file and the conflict is handed to a human.
  const withheld = new Set(add.filter((r) => !willAdd.includes(r)).map((r) => r.rel));
  const rolledBack: string[] = [];
  if (withheld.size) {
    const known = new Set(Object.keys(template));
    for (const rel of [...mergedClean, ...mergedConflicted]) {
      const refs = dependsOn(readIf(join(dir, rel)), rel, known).filter((d) => withheld.has(d));
      if (!refs.length) continue;
      writeFileSync(join(dir, rel), originals.get(rel) as string);
      rolledBack.push(`${rel}  ${dim(`referenced ${refs.join(", ")}, which was not added`)}`);
    }
    for (const r of rolledBack) {
      const rel = r.split(" ")[0];
      const i = mergedClean.indexOf(rel); if (i >= 0) mergedClean.splice(i, 1);
      const j = mergedConflicted.indexOf(rel); if (j >= 0) mergedConflicted.splice(j, 1);
      landed.delete(rel);
    }
  }
  for (const { rel } of [...willAdd, ...update]) {
    const to = join(dir, rel);
    if (process.env.KURUMERA_DEBUG_MERGE) console.error(`DBG copy ${rel}`);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(src, rel), to);
  }
  const written = willAdd.length + update.length;

  // A merge where every single file came out unchanged means the base was
  // wrong — most likely a --from that named a template too new to differ from
  // this one. Recording a baseline on top of that would claim the theme is
  // current when nothing was delivered, so it is refused outright.
  // Counts both "identical already" and "the template never changed it": from
  // the developer's side those are the same outcome — the merge delivered
  // nothing — and a baseline written on top of either would claim the theme is
  // current when it is not.
  const delivered = mergedClean.length + mergedConflicted.length + taken.length;
  const nothingCame = mergedNoop.length + mergeNothingToDo.length;
  const allNoop = wantsMerge && mergeable.length > 0 && delivered === 0 && nothingCame > 0;
  const notMerged = mergeTooDiverged.length + mergeSkipped.length + rolledBack.length;

  if (!allNoop) {
    // The baseline records, per file, the template version that file is in sync
    // with — so only the files this run actually brought forward get today's
    // hash. Stamping the whole template (which is what 0.16–0.19 did) claims a
    // theme is current while 21 files sit at an older template, and then the
    // next upgrade finds nothing to offer for exactly those files.
    const synced = new Set([...willAdd, ...update].map((r) => r.rel));
    mergedClean.forEach((r) => synced.add(r));
    mergedNoop.forEach((r) => synced.add(r));
    taken.forEach((r) => synced.add(r));

    const files: Record<string, string> = {};
    for (const rel of Object.keys(template)) {
      if (synced.has(rel)) { files[rel] = template[rel]; continue; }
      // Left behind: keep whatever the old baseline knew. Without an entry the
      // file stays `unknown` next time, which is the honest verdict — better
      // than `same`, which would hide a real pending change.
      const was = baseline?.files[rel];
      if (was) files[rel] = was;
    }
    // Only advance the recorded version once nothing is left behind; otherwise
    // keep the old one, because it is still the right merge base for the files
    // that did not move.
    const behind = Object.keys(template).some((rel) => !synced.has(rel) && !NEVER_WRITE.has(rel));

    // Per-file: a conflicted file HAS received the template's change (it is in
    // the file, behind the markers), so the next run must merge it from this
    // version and not re-raise the same conflict. Anything carried forward
    // keeps whatever version it was already recorded against.
    const syncedFrom: Record<string, string> = { ...(baseline?.syncedFrom || {}) };
    [...synced, ...mergedConflicted].forEach((rel) => { syncedFrom[rel] = version; });
    for (const rel of Object.keys(syncedFrom)) if (!template[rel]) delete syncedFrom[rel];

    writeBaseline(dir, behind ? baseline?.cli || version : version, files, syncedFrom);
  }

  console.log(green(`✓ Updated ${written} file(s) to CLI ${version}.`));
  reportBlocked(adds, "what they import would");
  reportWiring(willAdd, landed);
  if (mergedClean.length) {
    console.log(green(`✓ Merged ${mergedClean.length} file(s) you had edited, with no conflict.`));
    mergedClean.forEach((r) => console.log(`  ${r}`));
  }
  if (allNoop) {
    console.log(`\n${yellow(`Nothing was merged: all ${nothingCame} file(s) came out unchanged.`)}`);
    console.log(dim(`  Against CLI ${baseVersion} your files already look final, so there was nothing`));
    console.log(dim("  to bring forward. That almost always means the base version is wrong."));
    console.log(dim("  No baseline was recorded, so nothing now claims this theme is current."));
    console.log(dim("\n  Let me work the right one out:"));
    console.log(dim("  kurumera theme upgrade --merge --from auto --apply"));
  } else if (mergedNoop.length) {
    console.log(dim(`\n${mergedNoop.length} file(s) already identical to the template:`));
    mergedNoop.forEach((r) => console.log(dim(`  ${r}`)));
  }
  if (taken.length) {
    console.log(green(`\n✓ Replaced ${taken.length} file(s) with the template's version:`));
    taken.forEach((r) => console.log(`  ${r}`));
    console.log(dim("  Your version is in git, not here — `git diff` to see what went."));
  }
  if (takeFailed.length) {
    console.log(`\n${yellow("Could not --take:")}`);
    takeFailed.forEach((r) => console.log(`  ${r}`));
  }
  if (mergeNothingToDo.length) {
    console.log(`\n${yellow("A merge cannot help with these:")}`);
    mergeNothingToDo.forEach((r) => console.log(`  ${r}`));
    console.log(dim(`  The template has not changed them since CLI ${baseVersion}, so there is nothing`));
    console.log(dim("  to carry across — they differ because you edited them. Your two options:"));
    console.log(dim(`    see what you are missing:  kurumera theme upgrade --diff ${mergeNothingToDo[0]}`));
    console.log(dim(`    take the template's copy:   kurumera theme upgrade --take ${mergeNothingToDo[0]} --apply`));
    console.log(dim("  --take overwrites your file, so commit first."));
  }
  if (from && from !== "auto" && !allNoop) {
    console.log(dim(`\nBaseline recorded as CLI ${version}, merged against CLI ${baseVersion} (from --from).`));
    console.log(dim("If that base was wrong, revert and re-run with --from auto."));
  }
  if (mergedConflicted.length) {
    console.log(`
${yellow("Conflicts — both you and the template changed the same lines:")}`);
    mergedConflicted.forEach((r) => console.log(`  ${r}`));
    console.log(dim("  Each file carries <<<<<<< yours / ======= / >>>>>>> template markers."));
    // "Keep one side" was wrong advice and was reported as such: most of these
    // conflicts are two sides of an import block, both of them in use, and
    // dropping either deletes imports the file needs.
    console.log(dim("  These are usually two halves of an import block, both still needed —"));
    console.log(dim("  so keep BOTH sides unless they genuinely contradict, then delete the"));
    console.log(dim("  three marker lines. Never drop an import the file still uses."));
    console.log(dim("  Then: npx tsc --noEmit && kurumera theme check"));
    console.log(dim("  Or start over on a file:  git checkout -- <file>"));
  }
  if (unresolved.length) {
    console.log(`\n${yellow("Still carrying conflict markers from an earlier run — skipped:")}`);
    unresolved.forEach((r) => console.log(`  ${r}`));
    console.log(dim("  These do not compile as they stand, and merging into them would nest"));
    console.log(dim("  one conflict inside another. Resolve them first, or start over:"));
    console.log(dim(`    git checkout -- ${unresolved.join(" ")}`));
  }
  if (rolledBack.length) {
    console.log(`\n${yellow("Merge undone — it would have referenced a file this run did not add:")}`);
    rolledBack.forEach((r) => console.log(`  ${r}`));
    console.log(dim("  Your versions are back as they were. Bring the missing files in first:"));
    console.log(dim(`  ${remedy(true, true)}`));
  }
  if (mergeTooDiverged.length) {
    console.log(`\n${yellow("Not merged — these are your files now, not edited copies of the template:")}`);
    mergeTooDiverged.forEach((r) => console.log(`  ${r}`));
    console.log(dim("  A line-by-line merge into a rewritten file lands the template's additions"));
    console.log(dim("  in places that compile but mean nothing. It is refused rather than guessed."));
    console.log(dim(`    read the change, port it by hand:  kurumera theme upgrade --diff ${mergeTooDiverged[0].split(" ")[0]}`));
    console.log(dim(`    or give up your version entirely:  kurumera theme upgrade --take ${mergeTooDiverged[0].split(" ")[0]} --apply`));
  }
  if (mergeSkipped.length) {
    console.log(`\n${yellow("Could not merge, left alone:")}`);
    mergeSkipped.forEach((r) => console.log(`  ${r}`));
  }
  reportDependencies(dir, src, args.includes("--deps"));
  // Only count what is still untouched: a file we merged is no longer the
  // developer's problem, and listing it again would read as a failure.
  const handled = new Set([...mergedClean, ...mergedConflicted]);
  const untouched = [...yours, ...unknown].filter((r) => !handled.has(r.rel)).length;
  if (untouched) {
    console.log(`\n${yellow("Left alone:")} ${untouched} file(s) you have edited.`);
    console.log(dim("See what the template changed:  kurumera theme upgrade --diff"));
    console.log(dim(`Or let me merge them:           kurumera theme upgrade --merge${baseline ? "" : " --from auto"} --apply`));
  }
  console.log(`\n  ${dim("Then:")}  npm install && kurumera theme check`);
  return 0;
}

/**
 * Split the template's new files into the ones that can be added now and the
 * ones whose imports point at a file this run leaves behind.
 *
 * Writing the second kind is what turns an upgrade into a build failure on a
 * component the developer never asked for, so they are withheld and named.
 */
function partitionAdds(
  add: Row[],
  src: string,
  template: Record<string, string>,
  stale: Set<string>,
  stalePackages: Map<string, string>,
): Blocked {
  const known = new Set(Object.keys(template));
  const needs = new Map<string, string[]>();
  for (const { rel } of add) {
    let body = "";
    try { body = readFileSync(join(src, rel), "utf8"); } catch { /* reported below */ }
    const pkgs = packageImports(body).filter((p) => stalePackages.has(p));
    needs.set(rel, [...dependsOn(body, rel, known), ...pkgs]);
  }

  // Withholding one file can strand another that imports it — a contact page
  // importing a form importing the client we just withheld — so the set grows
  // to a fixed point. Without this the run writes a file it has already decided
  // cannot work.
  const held = new Map<string, string[]>();
  for (let changed = true; changed;) {
    changed = false;
    for (const { rel } of add) {
      if (held.has(rel)) continue;
      const missing = (needs.get(rel) || []).filter(
        (d) => stale.has(d) || held.has(d) || stalePackages.has(d),
      );
      if (!missing.length) continue;
      held.set(rel, missing);
      changed = true;
    }
  }

  const label = (d: string) => {
    const range = stalePackages.get(d);
    return range ? `${d} ${range}` : d;
  };
  return {
    willAdd: add.filter(({ rel }) => !held.has(rel)),
    blocked: [...held].map(([rel, m]) => `  ${rel}\n    ${dim(`needs ${m.map(label).join("; ")}`)}`).sort(),
    // Which flags would clear them, so the advice names the right command.
    needsMerge: [...held.values()].flat().some((d) => !stalePackages.has(d)),
    needsDeps: [...held.values()].flat().some((d) => stalePackages.has(d)),
  };
}

/**
 * A template whose packages moved on has to be said out loud, because `npm
 * install` will not widen a range the theme pinned below it.
 *
 * This matters more than it looks. A merged file can import something only the
 * newer package exports — `trackEvent` from `@kurumera/storefront@0.7`, say —
 * so an upgrade that brings the file but leaves the range behind produces a
 * theme that does not compile. Hence `--deps`: the ranges are reported by
 * default and written only when asked, because widening a major on a
 * zero-major package is the developer's call, not ours.
 *
 * Only the ranges move. Name, version, scripts and any package the template
 * does not declare are left exactly as they are.
 */
function reportDependencies(dir: string, src: string, write: boolean): void {
  const read = (p: string) => {
    try { return JSON.parse(readFileSync(join(p, "package.json"), "utf8")); } catch { return null; }
  };
  const mine = read(dir), theirs = read(src);
  if (!mine || !theirs) return;

  const diffs: string[] = [];
  const fields = ["dependencies", "devDependencies"] as const;
  for (const field of fields) {
    for (const [name, want] of Object.entries(theirs[field] || {})) {
      const have = (mine[field] || {})[name];
      if (have !== want) diffs.push(`  ${name}: ${have || dim("(missing)")} → ${want}  ${dim(`[${field}]`)}`);
    }
  }
  if (!diffs.length) return;

  if (write) {
    for (const field of fields) {
      const want = theirs[field];
      if (!want) continue;
      mine[field] = { ...(mine[field] || {}), ...want };
    }
    writeFileSync(join(dir, "package.json"), `${JSON.stringify(mine, null, 2)}\n`);
    console.log(`\n${green("✓ package.json dependency ranges updated:")}`);
    diffs.forEach((d) => console.log(d));
    console.log(dim("  Run npm install to pick them up."));
    return;
  }
  console.log(`\n${yellow("package.json was not touched")}, but the template now asks for:`);
  diffs.forEach((d) => console.log(d));
  console.log(dim("  Merged files may need these to compile. Write them:  --deps"));
}

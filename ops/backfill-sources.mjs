#!/usr/bin/env node
/**
 * Backfill `_sources` from the version directories still on disk.
 *
 * Source retention started on 3 August 2026. Every store pushed before that has
 * a live site and no retained source, so `kurumera theme pull` answers 404 and
 * the store cannot be recovered, edited or re-pushed by anyone who no longer has
 * the original folder. amberzia is the one that surfaced this: pushed 30 July,
 * running ever since, unrecoverable.
 *
 * It is recoverable, because a theme is not served from a built artifact. The
 * live container bind-mounts the version directory and runs `next start` inside
 * it, so that directory still holds the tree the CLI pushed, with node_modules
 * and .next added by the build. pruneVersions() keeps the live version
 * deliberately ("mounted by the live container"), so it has been preserved all
 * along. Nothing was lost; it was only ever missing from the one place
 * `theme pull` looks.
 *
 * This rebuilds the missing tarballs from those directories, with the same
 * exclusions the CLI push uses, so a recovered source matches what a push would
 * have retained.
 *
 *   node ops/backfill-sources.mjs                 # dry run: say what it would do
 *   node ops/backfill-sources.mjs --write         # actually write the tarballs
 *   node ops/backfill-sources.mjs --write --store amberzia
 *
 * Read-only by default, additive when writing: it only creates files under
 * _sources that are absent, and never touches a version directory, a container,
 * state.json, or anything the live site depends on. Safe to run while serving.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";

const ROOT = process.env.KURUMERA_PUSH_ROOT || "/home/ubuntu/theme-pushes";
const STATE = join(ROOT, "state.json");
const SOURCES = join(ROOT, "_sources");

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
const storeDir = (s) => join(ROOT, slug(s));
const versionDir = (s, v) => join(storeDir(s), "versions", v);

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const ONLY = args.includes("--store") ? slug(args[args.indexOf("--store") + 1]) : "";

// The CLI pushes with exactly these exclusions (packages/cli/src/commands/push.ts).
// Matching them means a backfilled tarball is what a push would have retained,
// not a bigger thing that happens to contain it.
const EXCLUDE = ["node_modules", ".next", ".git", "dist"];

/** A version directory is only worth archiving if it still looks like a theme. */
function looksLikeATheme(dir) {
  if (!existsSync(join(dir, "package.json"))) return false;
  return ["theme.config.ts", "theme.config.js"].some((f) => existsSync(join(dir, f)));
}

function readState() {
  try { return JSON.parse(readFileSync(STATE, "utf8")); } catch { return { stores: {} }; }
}

function human(bytes) {
  if (!bytes) return "0 KB";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
       : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Archive one version directory into _sources.
 *
 * Writes to a temp name and renames, so a reader (theme pull) can never see a
 * half-written tarball — the same reason the service does this for checkpoints.
 */
function archive(store, version, dir) {
  const outDir = join(SOURCES, store);
  const finalPath = join(outDir, `${version}.tgz`);
  const tmpPath = join(outDir, `.${version}.tgz.partial`);
  mkdirSync(outDir, { recursive: true });

  // Bundle to STDOUT and write the bytes here, running tar inside the directory,
  // so no absolute path is ever handed to tar. GNU tar reads a leading "C:\…"
  // as a remote host and dies with "Cannot connect to C:" — which is why
  // packages/cli/src/commands/push.ts bundles the same way.
  const r = spawnSync("tar", [
    "-czf", "-", ...EXCLUDE.map((e) => `--exclude=./${e}`), ".",
  ], { cwd: dir, maxBuffer: 512 * 1024 * 1024 });

  if (r.status !== 0 || !r.stdout || !r.stdout.length) {
    try { rmSync(tmpPath, { force: true }); } catch { /* */ }
    const err = (r.stderr ? r.stderr.toString() : "").trim().split("\n").pop();
    return { ok: false, error: err || `tar exited ${r.status}` };
  }
  writeFileSync(tmpPath, r.stdout);
  const size = statSync(tmpPath).size;
  // An empty-ish archive means the directory was not what we thought. Better to
  // leave nothing than to retain a tarball that pulls down to an unusable theme.
  if (size < 1024) {
    try { rmSync(tmpPath, { force: true }); } catch { /* */ }
    return { ok: false, error: `archive suspiciously small (${size} bytes)` };
  }
  renameSync(tmpPath, finalPath);
  return { ok: true, size };
}

function main() {
  if (!existsSync(ROOT)) {
    console.error(`No push root at ${ROOT}. Set KURUMERA_PUSH_ROOT if it lives elsewhere.`);
    return 1;
  }

  const state = readState();
  const stores = Object.keys(state.stores || {}).filter((s) => !ONLY || s === ONLY).sort();
  if (!stores.length) {
    console.error(ONLY ? `No store "${ONLY}" in ${STATE}.` : `No stores in ${STATE}.`);
    return 1;
  }

  console.log(WRITE ? "Backfilling retained source from live version directories.\n"
                    : "Dry run — nothing will be written. Add --write to do it.\n");

  let missing = 0, done = 0, failed = 0, skipped = 0, bytes = 0;

  for (const s of stores) {
    const rec = state.stores[s] || {};
    // The live version first: it is the one the store is actually serving, the
    // one pruneVersions protects, and the only one guaranteed to still be here.
    const candidates = [...new Set([rec.live, ...(rec.versions || [])].filter(Boolean))];
    const lines = [];

    for (const v of candidates) {
      if (existsSync(join(SOURCES, s, `${v}.tgz`))) continue;     // already retained
      missing++;
      const dir = versionDir(s, v);
      const live = v === rec.live ? " (live)" : "";

      if (!existsSync(dir)) {
        skipped++;
        lines.push(`  ${v}${live}  — build directory already reclaimed, nothing to recover`);
        continue;
      }
      if (!looksLikeATheme(dir)) {
        skipped++;
        lines.push(`  ${v}${live}  — no package.json + theme.config, skipped`);
        continue;
      }
      if (!WRITE) {
        lines.push(`  ${v}${live}  — would archive from ${dir}`);
        continue;
      }
      const r = archive(s, v, dir);
      if (r.ok) { done++; bytes += r.size; lines.push(`  ${v}${live}  ✓ retained (${human(r.size)})`); }
      else { failed++; lines.push(`  ${v}${live}  ✗ ${r.error}`); }
    }

    if (lines.length) {
      console.log(`${s}`);
      lines.forEach((l) => console.log(l));
      console.log("");
    }
  }

  if (!missing) {
    console.log("Every version already has retained source. Nothing to do.");
    return 0;
  }
  console.log(WRITE
    ? `${done} retained (${human(bytes)}), ${skipped} unrecoverable, ${failed} failed.`
    : `${missing - skipped} recoverable, ${skipped} unrecoverable. Re-run with --write.`);
  if (done) {
    console.log("\nCheck one before trusting the rest:");
    console.log("  kurumera theme pull --store <slug> --version <id> --out /tmp/recovered");
  }
  return failed ? 1 : 0;
}

process.exit(main());

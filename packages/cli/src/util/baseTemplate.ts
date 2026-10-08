/**
 * The template as it was when a theme was scaffolded — the third side of a
 * three-way merge.
 *
 * We do not keep a copy inside the theme. `.kurumera/baseline.json` records
 * which CLI version scaffolded it, every CLI version is on npm, and npm already
 * has to be present for any of this to work. So the base is fetched on demand
 * rather than duplicated into every repository.
 *
 * Cached under the user's own cache directory, because an upgrade of twelve
 * stores scaffolded on the same CLI should download that template once.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { npmBin } from "./fs.js";
import { hashTree } from "./baseline.js";

function cacheRoot(): string {
  return process.env.KURUMERA_TEMPLATE_CACHE
    || join(homedir(), ".kurumera", "template-cache");
}

/**
 * The bundled template of `@kurumera/cli@<version>`, or null when it cannot be
 * had — an unpublished version, no network, npm missing. Null means "merge is
 * not available here", never "the theme has no history".
 */
export function baseTemplateFor(version: string): string | null {
  if (!version || version === "unknown") return null;
  const cached = join(cacheRoot(), version, "template");
  if (existsSync(cached)) return cached;

  const work = mkdtempSync(join(tmpdir(), "kurumera-base-"));
  try {
    const packed = spawnSync(npmBin(),
      ["pack", `@kurumera/cli@${version}`, "--pack-destination", work, "--silent"],
      { encoding: "utf8", shell: process.platform === "win32" });
    if (packed.status !== 0) return null;

    const tgz = readdirSync(work).find((f) => f.endsWith(".tgz"));
    if (!tgz) return null;

    // Extract inside the work directory so no absolute path reaches tar: GNU
    // tar reads a leading "C:\…" as a remote host and fails to connect.
    const out = spawnSync("tar", ["-xzf", tgz], { cwd: work, encoding: "utf8" });
    if (out.status !== 0) return null;

    const extracted = join(work, "package", "template");
    if (!existsSync(extracted)) return null;

    // Copy into the cache rather than returning the temp path: the `finally`
    // below removes the work directory, so anything left inside it is gone by
    // the time the caller reads a file. (This cost an evening once.)
    mkdirSync(join(cacheRoot(), version), { recursive: true });
    cpSync(extracted, cached, { recursive: true });
    return cached;
  } catch {
    return null;
  } finally {
    try { rmSync(work, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

/** Every published @kurumera/cli version, oldest first. Empty when npm fails. */
export function publishedVersions(): string[] {
  const out = spawnSync(npmBin(), ["view", "@kurumera/cli", "versions", "--json"],
    { encoding: "utf8", shell: process.platform === "win32" });
  if (out.status !== 0) return [];
  try {
    const parsed = JSON.parse(out.stdout);
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch { return []; }
}

export interface BaseGuess {
  version: string;
  /** Files whose content still matches that version's template exactly. */
  matched: number;
  total: number;
}

/**
 * Work out which CLI version scaffolded a theme, by asking which published
 * template its UNTOUCHED files still match.
 *
 * This exists because `--from` was a trap. It asks the developer for a fact
 * nothing in the theme records, and a wrong answer is not an error — naming
 * today's version makes the base identical to the template, so every merge is
 * a no-op that reports success. A theme nobody rewrote from scratch still has
 * most of its files byte-identical to the template it came from, and that is a
 * measurement rather than a guess.
 *
 * Scored OLDEST first, and a tie keeps the older candidate. Consecutive
 * releases often ship an identical template, so the score plateaus; taking the
 * newest of a plateau picks a base with nothing left to apply, which is the
 * silent no-op this function exists to prevent. The oldest is always at least
 * as informative.
 *
 * A candidate whose template is identical to `current` is skipped outright: it
 * could only ever produce a no-op merge.
 */
export function detectBaseVersion(
  themeHashes: Record<string, string>,
  current: Record<string, string>,
  opts: { exclude?: string; onProgress?: (v: string) => void } = {},
): BaseGuess | null {
  const versions = publishedVersions().filter((v) => v !== opts.exclude);
  if (!versions.length) return null;

  const same = (a: Record<string, string>, b: Record<string, string>) => {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
  };

  const total = Object.keys(themeHashes).length;
  let best: BaseGuess | null = null;
  for (const version of versions) {
    opts.onProgress?.(version);
    const dir = baseTemplateFor(version);
    if (!dir) continue;
    const t = hashTree(dir);
    if (same(t, current)) continue;                  // identical to today: a guaranteed no-op
    let matched = 0;
    for (const [rel, hash] of Object.entries(t)) if (themeHashes[rel] === hash) matched++;
    if (!best || matched > best.matched) best = { version, matched, total };
  }
  return best;
}

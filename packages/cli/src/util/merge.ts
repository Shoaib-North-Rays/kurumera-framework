/**
 * Three-way merge, so an upgrade can combine the template's changes with the
 * developer's instead of choosing between them.
 *
 * Without a merge, `theme upgrade` only had two honest answers: replace a file
 * the developer never touched, or leave theirs alone. Any file they had edited
 * stayed frozen forever, which is exactly the file most likely to need the
 * template's fix. That is why themes drift and never come back.
 *
 * A merge needs three versions, and the one that is easy to forget is the BASE:
 * the template as it looked when this theme was scaffolded. We do not keep a
 * copy inside the theme — `.kurumera/baseline.json` records which CLI version
 * scaffolded it, and every CLI version is on npm, so the base is fetched rather
 * than stored. One small JSON file instead of a second copy of the template in
 * every repository.
 *
 * Where only one side changed a region, that side wins silently. Where both
 * changed overlapping regions, the result carries conflict markers in the shape
 * every developer already knows. We never guess which edit mattered more.
 *
 * The invariant that matters more than the merge quality: NOTHING IS LOST. A
 * line both sides kept must survive, and `conserves` below checks that on the
 * real output before it is written. A merge that cannot prove it is lossless
 * degrades to a conflict rather than writing plausible-looking broken code —
 * which is the one outcome worse than leaving the file alone.
 */
import { diffStat, lcs, MAX_LINES } from "./diff.js";

/** One contiguous edit against the base: base[start, end) becomes `lines`. */
interface Region {
  start: number;
  end: number;
  lines: string[];
}

export interface MergeResult {
  merged: string;
  /** How many regions neither side could agree on. */
  conflicts: number;
  /** False when the inputs were too large, or the merge could not be trusted. */
  ok: boolean;
}

/**
 * Turn an LCS of (base -> side) into edit regions keyed by BASE line numbers,
 * which is what lets two independent diffs be compared against each other.
 */
function regions(base: string[], side: string[]): Region[] {
  const out: Region[] = [];
  let baseIdx = 0;
  let current: Region | null = null;

  const flush = () => { if (current) { out.push(current); current = null; } };

  for (const op of lcs(base, side)) {
    if (op.tag === "same") { flush(); baseIdx++; continue; }
    if (!current) current = { start: baseIdx, end: baseIdx, lines: [] };
    if (op.tag === "del") { baseIdx++; current.end = baseIdx; }
    else current.lines.push(op.line);
  }
  flush();
  return out;
}

/**
 * One side's text for base[lo, hi), with its own edits applied — how that side
 * would have written this stretch of the file.
 */
function render(base: string[], lo: number, hi: number, rs: Region[]): string[] {
  const out: string[] = [];
  let i = lo;
  for (const r of rs) {
    for (; i < r.start && i < hi; i++) out.push(base[i]);
    out.push(...r.lines);
    i = Math.max(i, r.end);
  }
  for (; i < hi; i++) out.push(base[i]);
  return out;
}

const CONFLICT_START = "<<<<<<< yours";
const CONFLICT_MID = "=======";
const CONFLICT_END = ">>>>>>> template";

function counts(lines: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l, (m.get(l) || 0) + 1);
  return m;
}

/**
 * A necessary condition for a lossless merge: if BOTH sides kept a line, then
 * neither deleted it, so it must appear in the result at least as often as the
 * side that has fewer of it.
 *
 * This is what catches a structural line — a closing `}}`, a `/>` — being
 * dropped between two overlapping edits. It will not prove a merge correct,
 * but every bug of that shape fails it, and that bug writes code that does not
 * parse while reporting success.
 */
export function conserves(ours: string[], theirs: string[], merged: string[]): boolean {
  const o = counts(ours), t = counts(theirs), m = counts(merged);
  for (const [line, oc] of o) {
    const tc = t.get(line);
    if (!tc) continue;                        // only one side had it: free to go
    if (!line.trim()) continue;               // blank lines are not content
    if ((m.get(line) || 0) < Math.min(oc, tc)) return false;
  }
  return true;
}

/**
 * Merge `ours` and `theirs`, both derived from `base`.
 *
 * Returns the merged text with conflict markers where the two disagree, and a
 * count so a caller can refuse to write a file that needs a human.
 */
export function merge3(rawBase: string, rawOurs: string, rawTheirs: string): MergeResult {
  // Line endings are compared away and restored at the end. A theme checked out
  // on Windows, or through git with core.autocrlf, has CRLF files while the
  // template ships LF — and without this every single line looks changed, so
  // the whole file becomes one edit and the merge is garbage. It looks like a
  // merge bug and it is not.
  const eol = /\r\n/.test(rawOurs) ? "\r\n" : "\n";
  const base = rawBase.replace(/\r\n/g, "\n");
  const ours = rawOurs.replace(/\r\n/g, "\n");
  const theirs = rawTheirs.replace(/\r\n/g, "\n");
  const out = (text: string) => (eol === "\n" ? text : text.replace(/\n/g, eol));

  if (ours === theirs) return { merged: out(ours), conflicts: 0, ok: true };
  if (base === ours) return { merged: out(theirs), conflicts: 0, ok: true };   // only the template moved
  if (base === theirs) return { merged: out(ours), conflicts: 0, ok: true };   // only the developer moved

  const b = base.split("\n");
  const o = ours.split("\n");
  const t = theirs.split("\n");
  if (b.length > MAX_LINES || o.length > MAX_LINES || t.length > MAX_LINES) {
    return { merged: out(ours), conflicts: 0, ok: false };
  }

  const ourRegions = regions(b, o);
  const theirRegions = regions(b, t);

  const result: string[] = [];
  let conflicts = 0;
  let i = 0;            // position in the base
  let oi = 0, ti = 0;   // next unconsumed region on each side

  while (i < b.length || oi < ourRegions.length || ti < theirRegions.length) {
    const mine = ourRegions[oi];
    const yours = theirRegions[ti];
    const mineHere = mine && mine.start === i;
    const yoursHere = yours && yours.start === i;

    if (mineHere && yoursHere) {
      // Both sides edited from the same point. Grow the span until it contains
      // every region that touches it on either side — otherwise an edit that
      // starts inside the contested stretch has nowhere to go, and dropping it
      // is how whole lines disappear.
      let hi = Math.max(mine.end, yours.end);
      let oj = oi, tj = ti;
      for (let grew = true; grew;) {
        grew = false;
        while (ourRegions[oj] && ourRegions[oj].start <= hi) {
          hi = Math.max(hi, ourRegions[oj].end); oj++; grew = true;
        }
        while (theirRegions[tj] && theirRegions[tj].start <= hi) {
          hi = Math.max(hi, theirRegions[tj].end); tj++; grew = true;
        }
      }
      const oursText = render(b, i, hi, ourRegions.slice(oi, oj));
      const theirsText = render(b, i, hi, theirRegions.slice(ti, tj));

      // Agreeing is common in practice: the developer may have applied the
      // template's fix by hand already. Marking that a conflict would punish
      // them for keeping up.
      if (oursText.join("\n") === theirsText.join("\n")) {
        result.push(...oursText);
      } else {
        result.push(CONFLICT_START, ...oursText, CONFLICT_MID, ...theirsText, CONFLICT_END);
        conflicts++;
      }
      i = hi; oi = oj; ti = tj;
      continue;
    }

    if (mineHere) { result.push(...mine.lines); i = mine.end; oi++; continue; }
    if (yoursHere) { result.push(...yours.lines); i = yours.end; ti++; continue; }

    if (i < b.length) { result.push(b[i]); i++; continue; }

    // Past the end of the base: anything left is an append from one side.
    if (mine) { result.push(...mine.lines); oi++; continue; }
    if (yours) { result.push(...yours.lines); ti++; continue; }
    break;
  }

  // The safety net. A merge that cannot be shown to be lossless is not written
  // as a merge: both versions go in whole, under markers, for a human to read.
  if (!conserves(o, t, result)) {
    return {
      merged: out([CONFLICT_START, ...o, CONFLICT_MID, ...t, CONFLICT_END].join("\n")),
      conflicts: 1,
      ok: true,
    };
  }

  return { merged: out(result.join("\n")), conflicts, ok: true };
}

/** Whether merged text still needs a human. */
export function hasConflicts(text: string): boolean {
  return text.includes(CONFLICT_START);
}

/**
 * How far `ours` has moved from `base`, as a fraction of the file.
 *
 * This is the number that decides whether a three-way merge is trustworthy at
 * all. A line merge works by finding unchanged lines in the base and attaching
 * the other side's hunks between them. When the developer has rewritten the
 * file, the only lines still matching the base are the structural ones — a
 * blank line, a `}`, a `  );` — and a hunk anchored to one of those lands in a
 * position that has nothing to do with where it belongs.
 *
 * That is not a theoretical risk. It shipped: `<PageViews />` placed outside
 * the component it was meant to mount in, in a file that compiled and built
 * cleanly and rendered no analytics at all. Reported as "merged, no conflict".
 */
export function divergence(base: string, ours: string): number {
  if (base === ours) return 0;
  const { added, removed } = diffStat(base, ours);
  const lines = Math.max(base.split("\n").length, ours.split("\n").length, 1);
  return (added + removed) / lines;
}

/**
 * Above this, a merge is guesswork and is refused. Chosen from the real case:
 * the files that merged wrongly had rewritten 100% to 500% of their lines,
 * while a genuine small customisation sits in the low single digits.
 */
export const MAX_DIVERGENCE = 0.25;

/**
 * A ratio alone is unusable on a short file — one changed line out of six is
 * 33% and merges perfectly well. So a file is only called rewritten when it
 * has moved by a large SHARE and a meaningful NUMBER of lines.
 */
export const MIN_DIVERGED_LINES = 20;

export function tooDiverged(base: string, ours: string): { too: boolean; pct: number } {
  const { added, removed } = diffStat(base, ours);
  const changed = added + removed;
  const pct = divergence(base, ours);
  return { too: pct > MAX_DIVERGENCE && changed >= MIN_DIVERGED_LINES, pct };
}

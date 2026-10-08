/**
 * A unified diff, in the shape developers already read.
 *
 * `theme upgrade` used to print a list of filenames. "17 files left alone" tells
 * you nothing about whether you are missing a security fix or a changed comment,
 * so the only way to decide was to open both trees side by side. This prints the
 * same thing git would, so the decision can be made from the terminal.
 *
 * Written here rather than pulled from npm because this CLI has no runtime
 * dependencies, and keeping it that way is worth more than a tidier algorithm:
 * a theme tool that drags a dependency tree into a developer's machine is a
 * tool with a supply chain.
 */

const TTY = process.stdout.isTTY;
const paint = (c: string, s: string) => (TTY ? `\x1b[${c}m${s}\x1b[0m` : s);
const red = (s: string) => paint("31", s);
const green = (s: string) => paint("32", s);
const cyan = (s: string) => paint("36", s);
const dim = (s: string) => paint("2", s);
const bold = (s: string) => paint("1", s);

/** Above this, the quadratic table costs more than the diff is worth to read. */
export const MAX_LINES = 4000;

export type Op = { tag: "same" | "add" | "del"; line: string };

/**
 * Longest common subsequence over LINES.
 *
 * Quadratic, which is the right trade here: theme files are hundreds of lines,
 * the table is built once per file, and the simpler algorithm is the one a
 * maintainer can still follow in a year.
 */
export function lcs(a: string[], b: string[]): Op[] {
  // Identical head and tail are peeled off before the quadratic part. Two
  // versions of a real file usually share almost all of it, so this is what
  // lets an 8,000-line stylesheet with a 30-line edit be diffed and merged at
  // all — previously it hit MAX_LINES and was reported as "too large", which
  // meant a lightly edited big file could never be upgraded.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head
    && tail < b.length - head
    && a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) tail++;

  if (head === 0 && tail === 0) return lcsCore(a, b);
  const mid = lcsCore(a.slice(head, a.length - tail), b.slice(head, b.length - tail));
  const same = (line: string): Op => ({ tag: "same", line });
  return [
    ...a.slice(0, head).map(same),
    ...mid,
    ...a.slice(a.length - tail).map(same),
  ];
}

/** The lines left once the shared head and tail are removed — the real cost. */
export function diffSize(a: string[], b: string[]): number {
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head
    && tail < b.length - head
    && a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) tail++;
  return Math.max(a.length - head - tail, b.length - head - tail);
}

function lcsCore(a: string[], b: string[]): Op[] {
  const n = a.length, m = b.length;
  // table[i][j] = length of the LCS of a[i:] and b[j:]
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ tag: "same", line: a[i] }); i++; j++; }
    else if (table[i + 1][j] >= table[i][j + 1]) { ops.push({ tag: "del", line: a[i] }); i++; }
    else { ops.push({ tag: "add", line: b[j] }); j++; }
  }
  while (i < n) ops.push({ tag: "del", line: a[i++] });
  while (j < m) ops.push({ tag: "add", line: b[j++] });
  return ops;
}

export interface DiffOptions {
  /** Lines of unchanged context around each change. */
  context?: number;
  /** Label for the left side (what you have). */
  fromLabel?: string;
  /** Label for the right side (what the template has). */
  toLabel?: string;
}

/**
 * Unified diff between two file contents. Returns "" when they are identical,
 * so a caller can treat an empty string as "nothing to say".
 */
export function unifiedDiff(from: string, to: string, opts: DiffOptions = {}): string {
  if (from === to) return "";
  const context = opts.context ?? 3;
  const a = from.split("\n");
  const b = to.split("\n");

  if (diffSize(a, b) > MAX_LINES) {
    return dim(`  (${a.length} lines vs ${b.length} — too large to show inline; `
      + `compare the files directly)`);
  }

  const ops = lcs(a, b);

  // Which ops to print: every change, plus `context` unchanged lines either
  // side. Everything else is collapsed into the hunk headers.
  const keep = new Array(ops.length).fill(false);
  ops.forEach((op, k) => {
    if (op.tag === "same") return;
    for (let x = Math.max(0, k - context); x <= Math.min(ops.length - 1, k + context); x++) keep[x] = true;
  });

  const out: string[] = [];
  if (opts.fromLabel) out.push(red(`--- ${opts.fromLabel}`));
  if (opts.toLabel) out.push(green(`+++ ${opts.toLabel}`));

  let aLine = 1, bLine = 1;   // 1-based line numbers, as unified diff expects
  let k = 0;
  while (k < ops.length) {
    if (!keep[k]) {
      if (ops[k].tag !== "add") aLine++;
      if (ops[k].tag !== "del") bLine++;
      k++;
      continue;
    }
    // One hunk: consume while the window stays interesting.
    const aStart = aLine, bStart = bLine;
    const body: string[] = [];
    let aCount = 0, bCount = 0;
    while (k < ops.length && keep[k]) {
      const { tag, line } = ops[k];
      if (tag === "same") { body.push(dim(` ${line}`)); aCount++; bCount++; aLine++; bLine++; }
      else if (tag === "del") { body.push(red(`-${line}`)); aCount++; aLine++; }
      else { body.push(green(`+${line}`)); bCount++; bLine++; }
      k++;
    }
    out.push(cyan(`@@ -${aStart},${aCount} +${bStart},${bCount} @@`));
    out.push(...body);
  }
  return out.join("\n");
}

/** A one-line summary of a diff: how many lines come and go. */
export function diffStat(from: string, to: string): { added: number; removed: number } {
  if (from === to) return { added: 0, removed: 0 };
  const a = from.split("\n");
  const b = to.split("\n");
  if (diffSize(a, b) > MAX_LINES) {
    return { added: Math.max(0, b.length - a.length), removed: Math.max(0, a.length - b.length) };
  }
  let added = 0, removed = 0;
  for (const op of lcs(a, b)) {
    if (op.tag === "add") added++;
    else if (op.tag === "del") removed++;
  }
  return { added, removed };
}

/** `+12 -3`, coloured, or "" when nothing changed. */
export function formatStat(from: string, to: string): string {
  const { added, removed } = diffStat(from, to);
  if (!added && !removed) return "";
  const parts: string[] = [];
  if (added) parts.push(green(`+${added}`));
  if (removed) parts.push(red(`-${removed}`));
  return parts.join(" ");
}

export const diffHeading = (s: string) => bold(s);

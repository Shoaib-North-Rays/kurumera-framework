import { describe, expect, it } from "vitest";
import { diffStat, unifiedDiff } from "./diff.js";

/** Strip ANSI so assertions read the text, not the colours. */
const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("unifiedDiff", () => {
  it("says nothing when the files are identical", () => {
    expect(unifiedDiff("a\nb\n", "a\nb\n")).toBe("");
  });

  it("marks added and removed lines the way git does", () => {
    const out = plain(unifiedDiff("one\ntwo\nthree\n", "one\nTWO\nthree\n"));
    expect(out).toContain("-two");
    expect(out).toContain("+TWO");
    expect(out).toContain(" one");      // context, unprefixed
  });

  it("carries a hunk header with real line numbers", () => {
    const from = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
    const to = from.replace("line 10", "line TEN");
    expect(plain(unifiedDiff(from, to))).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
  });

  it("shows only the changed neighbourhood, not the whole file", () => {
    const from = Array.from({ length: 200 }, (_, i) => `line ${i}`).join("\n");
    const to = from.replace("line 100", "line HUNDRED");
    // 3 lines of context either side, two changed lines, one header, two file
    // labels. Printing all 200 would bury the one line that matters.
    expect(plain(unifiedDiff(from, to)).split("\n").length).toBeLessThan(15);
  });

  it("handles a file gaining content at the end", () => {
    const out = plain(unifiedDiff("a\n", "a\nb\nc\n"));
    expect(out).toContain("+b");
    expect(out).toContain("+c");
  });

  it("still diffs an enormous file when the change is small", () => {
    // The shared head and tail are peeled off before the quadratic part, so
    // size alone no longer makes a file undiffable — only real divergence does.
    const huge = Array.from({ length: 5000 }, (_, i) => `l${i}`).join("\n");
    const out = plain(unifiedDiff(huge, huge + "\nextra"));
    expect(out).toContain("+extra");
    expect(out).not.toContain("too large to show inline");
  });

  it("refuses to print a file that differs from end to end", () => {
    const a = Array.from({ length: 5000 }, (_, i) => `a${i}`).join("\n");
    const b = Array.from({ length: 5000 }, (_, i) => `b${i}`).join("\n");
    expect(plain(unifiedDiff(a, b))).toContain("too large to show inline");
  });
});

describe("diffStat", () => {
  it("counts what comes and goes", () => {
    expect(diffStat("a\nb\nc\n", "a\nX\nc\nd\n")).toEqual({ added: 2, removed: 1 });
  });

  it("is zero for identical files", () => {
    expect(diffStat("same\n", "same\n")).toEqual({ added: 0, removed: 0 });
  });

  it("counts a whole new file as additions", () => {
    expect(diffStat("", "a\nb\n").added).toBeGreaterThan(0);
  });
});

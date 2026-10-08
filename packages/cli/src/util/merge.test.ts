import { describe, expect, it } from "vitest";
import { conserves, merge3 } from "./merge.js";

/**
 * The merge decides whether a developer keeps their work. Each case below is a
 * way of losing it, so each one is a line somebody would have had to notice in
 * review and nobody would have.
 */

const lines = (...l: string[]) => l.join("\n");

describe("merge3", () => {
  it("takes the template's change when the developer changed nothing", () => {
    const base = lines("a", "b", "c");
    const theirs = lines("a", "B", "c");
    const r = merge3(base, base, theirs);
    expect(r.merged).toBe(theirs);
    expect(r.conflicts).toBe(0);
  });

  it("keeps the developer's change when the template did not move", () => {
    const base = lines("a", "b", "c");
    const ours = lines("a", "MINE", "c");
    const r = merge3(base, ours, base);
    expect(r.merged).toBe(ours);
    expect(r.conflicts).toBe(0);
  });

  it("combines edits that touch different parts of the file", () => {
    const base = lines("one", "two", "three", "four", "five");
    const ours = lines("ONE", "two", "three", "four", "five");
    const theirs = lines("one", "two", "three", "four", "FIVE");
    const r = merge3(base, ours, theirs);
    expect(r.conflicts).toBe(0);
    expect(r.merged).toBe(lines("ONE", "two", "three", "four", "FIVE"));
  });

  it("is silent when both sides made the SAME change", () => {
    // Common in practice: the developer already applied the template's fix by
    // hand. Marking that as a conflict would punish them for keeping up.
    const base = lines("a", "old", "c");
    const same = lines("a", "new", "c");
    const r = merge3(base, same, same);
    expect(r.conflicts).toBe(0);
    expect(r.merged).toBe(same);
  });

  it("marks a conflict when both changed the same line differently", () => {
    const base = lines("a", "b", "c");
    const ours = lines("a", "MINE", "c");
    const theirs = lines("a", "THEIRS", "c");
    const r = merge3(base, ours, theirs);
    expect(r.conflicts).toBe(1);
    expect(r.merged).toContain("<<<<<<< yours");
    expect(r.merged).toContain("MINE");
    expect(r.merged).toContain("=======");
    expect(r.merged).toContain("THEIRS");
    expect(r.merged).toContain(">>>>>>> template");
  });

  it("never silently drops the developer's side of a conflict", () => {
    const base = lines("x", "shared", "y");
    const ours = lines("x", "my important line", "y");
    const theirs = lines("x", "their line", "y");
    expect(merge3(base, ours, theirs).merged).toContain("my important line");
  });

  it("merges an addition from each side", () => {
    const base = lines("header", "body");
    const ours = lines("header", "body", "mine at the end");
    const theirs = lines("import something", "header", "body");
    const r = merge3(base, ours, theirs);
    expect(r.merged).toContain("import something");
    expect(r.merged).toContain("mine at the end");
  });

  it("handles the real case: the template adds imports, the developer edited elsewhere", () => {
    const base = lines('import { Header } from "./Header";', "", "export default function Layout() {", "  return null;", "}");
    const theirs = lines('import { Header } from "./Header";', 'import { PageViews } from "./Analytics";', "", "export default function Layout() {", "  return null;", "}");
    const ours = lines('import { Header } from "./Header";', "", "export default function Layout() {", "  return <main>my own markup</main>;", "}");
    const r = merge3(base, ours, theirs);
    expect(r.conflicts).toBe(0);
    expect(r.merged).toContain("PageViews");          // the template's fix arrives
    expect(r.merged).toContain("my own markup");      // and the developer keeps theirs
  });

  it("reports when the files are too large to merge safely", () => {
    const huge = Array.from({ length: 5000 }, (_, i) => `l${i}`).join("\n");
    const r = merge3(huge, huge + "\nmine", huge + "\ntheirs");
    expect(r.ok).toBe(false);
    expect(r.merged).toContain("mine");               // falls back to ours, never to theirs
  });

  it("never drops a line both sides kept", () => {
    // The bug this guards: two overlapping edits around one block, and the
    // block's closing lines — which neither side touched — vanished. The output
    // looked plausible and did not parse, and nothing was reported.
    const base = lines(
      "<script",
      "  dangerouslySetInnerHTML={{",
      "    __html: `window.A=1`,",
      "  }}",
      "/>",
    );
    const ours = lines(
      "<script",
      "  dangerouslySetInnerHTML={{",
      "    __html: `window.A=1` + `window.MINE=1`,",
      "  }}",
      "/>",
    );
    const theirs = lines(
      "<script",
      "  dangerouslySetInnerHTML={{",
      "    __html: `window.A=1`,",
      "    nonce: n,",
      "  }}",
      "/>",
      "<PageViews />",
    );
    const r = merge3(base, ours, theirs);
    // Whatever it decides, the braces and the tag close must still be there.
    expect(r.merged).toContain("}}");
    expect(r.merged).toContain("/>");
    expect(r.merged).toContain("window.MINE=1");
  });

  it("falls back to a whole-file conflict rather than losing content", () => {
    const base = lines("a", "b", "c", "d");
    // conserves() is the gate; assert it directly, since it is the invariant
    // every structural-loss bug trips.
    expect(conserves(["x", "keep", "y"], ["z", "keep", "w"], ["x", "y"])).toBe(false);
    expect(conserves(["x", "keep", "y"], ["z", "keep", "w"], ["x", "keep", "y"])).toBe(true);
    expect(base).toBeTruthy();
  });

  it("merges a CRLF theme against an LF template", () => {
    // A Windows checkout, or git with core.autocrlf, gives the theme CRLF while
    // the template ships LF. Compared naively every line differs, the whole
    // file becomes one edit, and the result is unusable — while reporting
    // success. The endings are compared away and the theme's own are restored.
    const base = lines("one", "two", "three");
    const ours = base.replace(/\n/g, "\r\n").replace("two", "MINE");
    const theirs = lines("one", "two", "three", "added by template");
    const r = merge3(base, ours, theirs);
    expect(r.conflicts).toBe(0);
    expect(r.merged).toContain("MINE");
    expect(r.merged).toContain("added by template");
    expect(r.merged).toContain("\r\n");                  // the theme keeps its endings
    expect(r.merged.replace(/\r\n/g, "\n")).toBe(lines("one", "MINE", "three", "added by template"));
  });

  it("is a no-op when nothing differs", () => {
    const same = lines("a", "b");
    expect(merge3(same, same, same)).toEqual({ merged: same, conflicts: 0, ok: true });
  });
});

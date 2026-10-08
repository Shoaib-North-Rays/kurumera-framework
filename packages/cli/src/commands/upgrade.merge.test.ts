import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { themeUpgrade } from "./upgrade.js";
import { hashTree, writeBaseline } from "../util/baseline.js";

/**
 * `--merge` is the only part of upgrade that rewrites a file somebody edited.
 * Every test here is a way of losing that work — a side dropped, a conflict
 * resolved by guesswork, a merge attempted with no real common ancestor.
 */

const made: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "kurumera-merge-"));
  made.push(d);
  return d;
}
const write = (root: string, rel: string, body: string) => {
  mkdirSync(join(root, rel, ".."), { recursive: true });
  writeFileSync(join(root, rel), body);
};
const read = (root: string, rel: string) => readFileSync(join(root, rel), "utf8");

function upgrade(theme: string, template: string, ...flags: string[]): number {
  const prev = process.env.KURUMERA_BASE_THEME;
  process.env.KURUMERA_BASE_THEME = template;
  try { return themeUpgrade(["--dir", theme, ...flags]); }
  finally { if (prev === undefined) delete process.env.KURUMERA_BASE_THEME; else process.env.KURUMERA_BASE_THEME = prev; }
}

/** Capture what the command told the developer. */
function spoken(fn: () => void): string {
  const logs: string[] = [];
  const spy = console.log;
  console.log = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); };
  try { fn(); } finally { console.log = spy; }
  return logs.join("\n");
}

/**
 * Stand in for npm: `baseTemplateFor` checks the cache before fetching, so a
 * populated cache entry makes these tests exercise the merge, not the network.
 */
function publishBase(version: string, template: string): void {
  // Additive, so a test can publish more than one version into the same cache.
  // It matters: without an entry the code falls through to a real `npm pack`,
  // and a test that quietly downloads the published CLI proves nothing.
  const cache = process.env.KURUMERA_TEMPLATE_CACHE || tmp();
  const dest = join(cache, version, "template");
  for (const rel of Object.keys(hashTree(template))) write(dest, rel, read(template, rel));
  process.env.KURUMERA_TEMPLATE_CACHE = cache;
}

/** This CLI's own version — the baseline an --apply leaves behind. */
const THIS_CLI: string = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
).version;

afterEach(() => {
  delete process.env.KURUMERA_TEMPLATE_CACHE;
  for (const d of made.splice(0)) { try { rmSync(d, { recursive: true, force: true }); } catch { /* */ } }
});

const BASE_LAYOUT = [
  `import { Header } from "./Header";`,
  ``,
  `export default function Layout() {`,
  `  return null;`,
  `}`,
  ``,
].join("\n");

/** The template's change: a new import, nowhere near the body. */
const NEW_LAYOUT = [
  `import { Header } from "./Header";`,
  `import { PageViews } from "./Analytics";`,
  ``,
  `export default function Layout() {`,
  `  return null;`,
  `}`,
  ``,
].join("\n");

/** The developer's change: the body, nowhere near the imports. */
const MY_LAYOUT = [
  `import { Header } from "./Header";`,
  ``,
  `export default function Layout() {`,
  `  return <main>MY MARKUP</main>;`,
  `}`,
  ``,
].join("\n");

function versions() {
  const v1 = tmp();
  write(v1, "package.json", `{"name":"base"}\n`);
  write(v1, "app/layout.tsx", BASE_LAYOUT);
  const v2 = tmp();
  write(v2, "package.json", `{"name":"base"}\n`);
  write(v2, "app/layout.tsx", NEW_LAYOUT);
  return { v1, v2 };
}

/** A theme scaffolded from `template`, with a baseline, as `init` leaves it. */
function scaffold(template: string, cli = "0.0.0-test"): string {
  const theme = tmp();
  for (const rel of Object.keys(hashTree(template))) write(theme, rel, read(template, rel));
  writeBaseline(theme, cli, hashTree(template));
  return theme;
}

/** An older theme: same files, no `.kurumera/baseline.json`. */
function legacy(template: string): string {
  const theme = tmp();
  for (const rel of Object.keys(hashTree(template))) write(theme, rel, read(template, rel));
  return theme;
}

describe("theme upgrade --merge", () => {
  it("combines the template's change with the developer's", () => {
    const { v1, v2 } = versions();
    const theme = scaffold(v1);
    write(theme, "app/layout.tsx", MY_LAYOUT);
    publishBase("0.0.0-test", v1);

    expect(upgrade(theme, v2, "--merge", "--apply")).toBe(0);
    const out = read(theme, "app/layout.tsx");
    expect(out).toContain("PageViews");       // the template's fix arrives
    expect(out).toContain("MY MARKUP");       // and the edit survives
    expect(out).not.toContain("<<<<<<<");
  });

  it("writes conflict markers rather than choosing a side", () => {
    const { v1, v2 } = versions();
    // Both sides rewrite the SAME line — the one case nobody should decide for us.
    write(v2, "app/layout.tsx", NEW_LAYOUT.replace("./Header", "./layout/Header"));
    const theme = scaffold(v1);
    write(theme, "app/layout.tsx", BASE_LAYOUT.replace("./Header", "./MyHeader"));
    publishBase("0.0.0-test", v1);

    upgrade(theme, v2, "--merge", "--apply");
    const out = read(theme, "app/layout.tsx");
    expect(out).toContain("<<<<<<< yours");
    expect(out).toContain("./MyHeader");      // never silently dropped
    expect(out).toContain(">>>>>>> template");
  });

  it("names the conflicted files and how to finish them", () => {
    const { v1, v2 } = versions();
    write(v2, "app/layout.tsx", NEW_LAYOUT.replace("./Header", "./layout/Header"));
    const theme = scaffold(v1);
    write(theme, "app/layout.tsx", BASE_LAYOUT.replace("./Header", "./MyHeader"));
    publishBase("0.0.0-test", v1);

    const said = spoken(() => upgrade(theme, v2, "--merge", "--apply"));
    expect(said).toContain("app/layout.tsx");
    expect(said).toContain("Conflicts");
    expect(said).toContain("kurumera theme check");
  });

  it("leaves edited files alone without --merge", () => {
    const { v1, v2 } = versions();
    const theme = scaffold(v1);
    write(theme, "app/layout.tsx", MY_LAYOUT);
    publishBase("0.0.0-test", v1);

    upgrade(theme, v2, "--apply");
    expect(read(theme, "app/layout.tsx")).toBe(MY_LAYOUT);
  });

  it("refuses to merge a theme with no baseline, and says how to proceed", () => {
    const { v1, v2 } = versions();
    const theme = legacy(v1);
    write(theme, "app/layout.tsx", MY_LAYOUT);
    publishBase("0.9.0", v1);

    const said = spoken(() => upgrade(theme, v2, "--merge", "--apply"));
    expect(read(theme, "app/layout.tsx")).toBe(MY_LAYOUT);   // nothing guessed
    expect(said).toContain("--from");                        // the way forward
  });

  it("merges an old theme once --from names the base", () => {
    const { v1, v2 } = versions();
    const theme = legacy(v1);
    write(theme, "app/layout.tsx", MY_LAYOUT);
    publishBase("0.9.0", v1);

    expect(upgrade(theme, v2, "--merge", "--from", "0.9.0", "--apply")).toBe(0);
    const out = read(theme, "app/layout.tsx");
    expect(out).toContain("PageViews");
    expect(out).toContain("MY MARKUP");
  });

  it("reports a file with no common ancestor instead of guessing", () => {
    const { v1, v2 } = versions();
    write(v2, "components/Analytics.tsx", "template version\n");
    const theme = scaffold(v1);
    write(theme, "components/Analytics.tsx", "my own version\n");   // same path, never in v1
    publishBase("0.0.0-test", v1);

    // --from, because a file absent from the baseline is `unknown`, not `yours`.
    const said = spoken(() => upgrade(theme, v2, "--merge", "--from", "0.0.0-test", "--apply"));
    expect(read(theme, "components/Analytics.tsx")).toBe("my own version\n");
    expect(said).toContain("Could not merge");
  });

  it("never writes package.json, even with --merge --from", () => {
    const { v1, v2 } = versions();
    const theme = scaffold(v1);
    write(theme, "package.json", `{"name":"mine"}\n`);
    write(v2, "package.json", `{"name":"base","dependencies":{"x":"1"}}\n`);
    publishBase("0.0.0-test", v1);

    upgrade(theme, v2, "--merge", "--from", "0.0.0-test", "--apply");
    expect(read(theme, "package.json")).toBe(`{"name":"mine"}\n`);
  });

  it("does not list a merged file as left alone", () => {
    const { v1, v2 } = versions();
    const theme = scaffold(v1);
    write(theme, "app/layout.tsx", MY_LAYOUT);
    publishBase("0.0.0-test", v1);

    const said = spoken(() => upgrade(theme, v2, "--merge", "--apply"));
    expect(said).toContain("Merged");
    expect(said).not.toContain("Left alone");
  });

  it("reports dependency ranges without --deps, and writes them with it", () => {
    const { v1, v2 } = versions();
    write(v2, "package.json", `{"name":"base","dependencies":{"@kurumera/storefront":"^0.7.0"}}\n`);
    const theme = scaffold(v1);
    write(theme, "package.json", `{"name":"mine","version":"1.0.0","dependencies":{"@kurumera/storefront":"^0.3.0"}}\n`);
    publishBase("0.0.0-test", v1);

    const quiet = spoken(() => upgrade(theme, v2, "--apply"));
    expect(quiet).toContain("--deps");
    expect(read(theme, "package.json")).toContain(`"^0.3.0"`);   // nothing written

    upgrade(theme, v2, "--deps", "--apply");
    const after = JSON.parse(read(theme, "package.json"));
    expect(after.dependencies["@kurumera/storefront"]).toBe("^0.7.0");
    expect(after.name).toBe("mine");                             // identity untouched
    expect(after.version).toBe("1.0.0");
  });

  it("--deps leaves a package the template does not declare alone", () => {
    const { v1, v2 } = versions();
    write(v2, "package.json", `{"name":"base","dependencies":{"@kurumera/storefront":"^0.7.0"}}\n`);
    const theme = scaffold(v1);
    write(theme, "package.json", `{"name":"mine","dependencies":{"@kurumera/storefront":"^0.3.0","zod":"^3.0.0"}}\n`);
    publishBase("0.0.0-test", v1);

    upgrade(theme, v2, "--deps", "--apply");
    expect(JSON.parse(read(theme, "package.json")).dependencies.zod).toBe("^3.0.0");
  });

  it("is idempotent — a second merge changes nothing", () => {
    const { v1, v2 } = versions();
    const theme = scaffold(v1);
    write(theme, "app/layout.tsx", MY_LAYOUT);
    publishBase("0.0.0-test", v1);
    // The first --apply rewrites the baseline to this CLI, so the second run's
    // merge base is this CLI's template — which here is v2.
    publishBase(THIS_CLI, v2);

    upgrade(theme, v2, "--merge", "--apply");
    const after = hashTree(theme);
    upgrade(theme, v2, "--merge", "--apply");
    expect(hashTree(theme)).toEqual(after);
  });
});

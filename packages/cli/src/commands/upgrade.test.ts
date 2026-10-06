import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { themeUpgrade } from "./upgrade.js";
import { hashTree, writeBaseline } from "../util/baseline.js";

/**
 * The promise `theme upgrade` makes is narrow and absolute: it brings base files
 * forward and never touches work somebody did. Everything here guards that
 * promise, because the failure mode is silent and unrecoverable — a developer's
 * customisation replaced by the starter's version, discovered later.
 */

const made: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "kurumera-upgrade-"));
  made.push(d);
  return d;
}
const write = (root: string, rel: string, body: string) => {
  mkdirSync(join(root, rel, ".."), { recursive: true });
  writeFileSync(join(root, rel), body);
};
const read = (root: string, rel: string) => readFileSync(join(root, rel), "utf8");

/** Run the command against a specific template, the way a real CLI release would. */
function upgrade(theme: string, template: string, ...flags: string[]): number {
  const prev = process.env.KURUMERA_BASE_THEME;
  process.env.KURUMERA_BASE_THEME = template;
  try { return themeUpgrade(["--dir", theme, ...flags]); }
  finally { if (prev === undefined) delete process.env.KURUMERA_BASE_THEME; else process.env.KURUMERA_BASE_THEME = prev; }
}

afterEach(() => {
  for (const d of made.splice(0)) { try { rmSync(d, { recursive: true, force: true }); } catch { /* */ } }
});

/** A theme scaffolded from `template`, with a baseline, as `init` leaves it. */
function scaffold(template: string): string {
  const theme = tmp();
  for (const rel of Object.keys(hashTree(template))) write(theme, rel, read(template, rel));
  writeBaseline(theme, "0.0.0-test", hashTree(template));
  return theme;
}

function templateV1(): string {
  const t = tmp();
  write(t, "package.json", '{"name":"base"}\n');
  write(t, "app/page.tsx", "v1 page\n");
  write(t, "components/Header.tsx", "v1 header\n");
  return t;
}

describe("theme upgrade", () => {
  it("never overwrites a file the developer edited", () => {
    const v1 = templateV1();
    const theme = scaffold(v1);
    write(theme, "components/Header.tsx", "MY BRAND\n");

    const v2 = templateV1();
    write(v2, "components/Header.tsx", "v2 header\n");

    expect(upgrade(theme, v2, "--apply")).toBe(0);
    expect(read(theme, "components/Header.tsx")).toBe("MY BRAND\n");
  });

  it("updates a file that has not been touched since scaffolding", () => {
    const v1 = templateV1();
    const theme = scaffold(v1);

    const v2 = templateV1();
    write(v2, "app/page.tsx", "v2 page\n");

    upgrade(theme, v2, "--apply");
    expect(read(theme, "app/page.tsx")).toBe("v2 page\n");
  });

  it("adds a file the template has only just gained", () => {
    const theme = scaffold(templateV1());
    const v2 = templateV1();
    write(v2, "components/ContactForm.tsx", "new\n");

    upgrade(theme, v2, "--apply");
    expect(read(theme, "components/ContactForm.tsx")).toBe("new\n");
  });

  it("does not resurrect a file the developer deleted", () => {
    const v2 = templateV1();
    const theme = scaffold(v2);
    rmSync(join(theme, "components/Header.tsx"));

    upgrade(theme, v2, "--apply");
    expect(existsSync(join(theme, "components/Header.tsx"))).toBe(false);
  });

  it("leaves package.json alone — its name and ranges belong to the theme", () => {
    const v1 = templateV1();
    const theme = scaffold(v1);
    write(theme, "package.json", '{"name":"mytheme"}\n');

    const v2 = templateV1();
    write(v2, "package.json", '{"name":"base","dependencies":{"x":"^2.0.0"}}\n');

    upgrade(theme, v2, "--apply");
    expect(read(theme, "package.json")).toBe('{"name":"mytheme"}\n');
  });

  it("writes nothing without --apply", () => {
    const theme = scaffold(templateV1());
    const v2 = templateV1();
    write(v2, "app/page.tsx", "v2 page\n");

    upgrade(theme, v2);
    expect(read(theme, "app/page.tsx")).toBe("v1 page\n");
  });

  it("with no baseline, only adds genuinely new files and touches nothing else", () => {
    // An old theme, scaffolded before baselines existed. Edits cannot be told
    // from template changes, so every differing file has to be left alone.
    const theme = tmp();
    const v1 = templateV1();
    for (const rel of Object.keys(hashTree(v1))) write(theme, rel, read(v1, rel));
    write(theme, "components/Header.tsx", "LEGACY BRAND\n");

    const v2 = templateV1();
    write(v2, "components/Header.tsx", "v2 header\n");
    write(v2, "app/page.tsx", "v2 page\n");
    write(v2, "components/New.tsx", "new\n");

    upgrade(theme, v2, "--apply");
    expect(read(theme, "components/Header.tsx")).toBe("LEGACY BRAND\n");
    expect(read(theme, "app/page.tsx")).toBe("v1 page\n");      // ambiguous, untouched
    expect(read(theme, "components/New.tsx")).toBe("new\n");    // unambiguous, added
  });

  it("is idempotent — a second run changes nothing", () => {
    const theme = scaffold(templateV1());
    const v2 = templateV1();
    write(v2, "app/page.tsx", "v2 page\n");

    upgrade(theme, v2, "--apply");
    const after = hashTree(theme);
    upgrade(theme, v2, "--apply");
    expect(hashTree(theme)).toEqual(after);
  });
});

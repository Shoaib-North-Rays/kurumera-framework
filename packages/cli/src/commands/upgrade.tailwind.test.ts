import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { themeUpgrade } from "./upgrade.js";
import { hashTree, writeBaseline } from "../util/baseline.js";
import { postcssPlugins } from "../util/imports.js";

/**
 * The base theme gained Tailwind: two new files (postcss.config.mjs,
 * app/tailwind.css), one changed import in the root layout, three new
 * devDependencies. A theme scaffolded before that must either get all of it
 * or none of it — any part without the packages fails every build.
 *
 * The trap was postcss.config.mjs: it names its plugin as a string, so the
 * import scanner saw no dependency and added it to themes that had not
 * installed @tailwindcss/postcss ("Cannot find module").
 */

const made: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "kurumera-tailwind-"));
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

/** Stand in for npm, so the merge test merges against the old template, not the network. */
function publishBase(version: string, template: string): void {
  const cache = process.env.KURUMERA_TEMPLATE_CACHE || tmp();
  const dest = join(cache, version, "template");
  for (const rel of Object.keys(hashTree(template))) write(dest, rel, read(template, rel));
  process.env.KURUMERA_TEMPLATE_CACHE = cache;
}

afterEach(() => {
  delete process.env.KURUMERA_TEMPLATE_CACHE;
  for (const d of made.splice(0)) { try { rmSync(d, { recursive: true, force: true }); } catch { /* */ } }
});

const PKG_V1 = { name: "base", devDependencies: { typescript: "^5.6.3" } };
const PKG_V2 = { name: "base", devDependencies: { "@tailwindcss/postcss": "^4.3.0", postcss: "^8.5.0", tailwindcss: "^4.3.0", typescript: "^5.6.3" } };
const POSTCSS = `export default {\n  plugins: {\n    "@tailwindcss/postcss": {},\n  },\n};\n`;

function templateBefore(): string {
  const t = tmp();
  write(t, "package.json", JSON.stringify(PKG_V1));
  write(t, "app/globals.css", ".card { padding: 16px; }\n");
  write(t, "app/layout.tsx", `import "./globals.css";\nexport default function L() { return null; }\n`);
  return t;
}
function templateAfter(): string {
  const t = templateBefore();
  write(t, "package.json", JSON.stringify(PKG_V2));
  write(t, "postcss.config.mjs", POSTCSS);
  write(t, "app/tailwind.css", `@import "tailwindcss/theme.css" layer(theme);\n@import "tailwindcss/utilities.css";\n`);
  write(t, "app/layout.tsx", `import "./globals.css";\nimport "./tailwind.css";\nexport default function L() { return null; }\n`);
  return t;
}
function scaffold(template: string): string {
  const theme = tmp();
  for (const rel of Object.keys(hashTree(template))) write(theme, rel, read(template, rel));
  writeBaseline(theme, "0.0.0-test", hashTree(template));
  return theme;
}

describe("postcssPlugins", () => {
  it("reads plugin names from the object and the array form", () => {
    expect(postcssPlugins(POSTCSS)).toEqual(["@tailwindcss/postcss"]);
    expect(postcssPlugins(`module.exports = { plugins: { autoprefixer: {}, "@tailwindcss/postcss": { base: "." } } }`))
      .toEqual(["@tailwindcss/postcss"]);
    expect(postcssPlugins(`export default { plugins: ["@tailwindcss/postcss", 'autoprefixer'] };`))
      .toEqual(["@tailwindcss/postcss", "autoprefixer"]);
    expect(postcssPlugins(`export default {};`)).toEqual([]);
  });
});

describe("theme upgrade: Tailwind arriving in the template", () => {
  it("without --deps adds none of it, and says how", () => {
    const theme = scaffold(templateBefore());
    expect(upgrade(theme, templateAfter(), "--apply")).toBe(0);
    expect(existsSync(join(theme, "postcss.config.mjs"))).toBe(false);
    expect(existsSync(join(theme, "app/tailwind.css"))).toBe(false);
    // The layout must not import a stylesheet that was held back.
    expect(read(theme, "app/layout.tsx")).not.toContain("tailwind.css");
    // ...and a second run with --deps still delivers all of it.
    expect(upgrade(theme, templateAfter(), "--deps", "--apply")).toBe(0);
    expect(read(theme, "app/layout.tsx")).toContain(`import "./tailwind.css";`);
    expect(existsSync(join(theme, "postcss.config.mjs"))).toBe(true);
  });

  it("with --deps brings the packages, both files and the layout import", () => {
    const theme = scaffold(templateBefore());
    expect(upgrade(theme, templateAfter(), "--deps", "--apply")).toBe(0);
    expect(read(theme, "postcss.config.mjs")).toBe(POSTCSS);
    expect(existsSync(join(theme, "app/tailwind.css"))).toBe(true);
    expect(read(theme, "app/layout.tsx")).toContain(`import "./tailwind.css";`);
    const pkg = JSON.parse(read(theme, "package.json"));
    expect(pkg.devDependencies).toMatchObject({ tailwindcss: "^4.3.0", "@tailwindcss/postcss": "^4.3.0", postcss: "^8.5.0" });
  });

  it("with --merge --deps keeps a developer's own layout and adds the import", () => {
    const before = templateBefore();
    publishBase("0.0.0-test", before);
    const theme = scaffold(before);
    // An edit away from the import block, as a real layout edit usually is.
    write(theme, "app/layout.tsx", `import "./globals.css";\nexport default function L() { return null; }\nexport const brand = "mine";\n`);
    expect(upgrade(theme, templateAfter(), "--merge", "--deps", "--apply")).toBe(0);
    const layout = read(theme, "app/layout.tsx");
    expect(layout).toContain(`import "./tailwind.css";`);
    expect(layout).toContain(`export const brand = "mine";`);
  });
});

describe("theme upgrade: a package range the template raised", () => {
  /**
   * The product page started reading `product.media` (storefront 0.11). A
   * theme on storefront ^0.9 that took the new page without the new range
   * failed its type check — the page was copied because nobody had edited it.
   */
  function sdkTemplate(range: string, page: string): string {
    const t = tmp();
    write(t, "package.json", JSON.stringify({ name: "base", dependencies: { "@kurumera/storefront": range } }));
    write(t, "app/products/[handle]/page.tsx", page);
    return t;
  }
  const OLD_PAGE = `import { getStore } from "@/lib/kurumera";\nimport type { Product } from "@kurumera/storefront";\nexport default function P() { return null; }\n`;
  const NEW_PAGE = `import { getStore } from "@/lib/kurumera";\nimport type { Product } from "@kurumera/storefront";\nconst m = (p: Product) => p.media;\nexport default function P() { return null; }\n`;

  it("without --deps leaves the untouched page alone, and says why", () => {
    const theme = scaffold(sdkTemplate("^0.9.0", OLD_PAGE));
    expect(upgrade(theme, sdkTemplate("^0.11.0", NEW_PAGE), "--apply")).toBe(0);
    expect(read(theme, "app/products/[handle]/page.tsx")).toBe(OLD_PAGE);
  });

  it("with --deps updates the page and the range together", () => {
    const theme = scaffold(sdkTemplate("^0.9.0", OLD_PAGE));
    expect(upgrade(theme, sdkTemplate("^0.11.0", NEW_PAGE), "--deps", "--apply")).toBe(0);
    expect(read(theme, "app/products/[handle]/page.tsx")).toBe(NEW_PAGE);
    expect(JSON.parse(read(theme, "package.json")).dependencies["@kurumera/storefront"]).toBe("^0.11.0");
  });
});

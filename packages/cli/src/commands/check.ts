import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { checkTheme, type Category, type Finding } from "../lib/themeCheck.js";

const ORDER: Category[] = ["contract", "security", "dependencies", "config", "commerce", "seo", "env"];
const LABEL: Record<Category, string> = {
  contract: "Route contract", security: "Security", dependencies: "Dependencies",
  config: "Config", commerce: "Commerce UX", seo: "SEO", env: "Environment",
};

/** `kurumera theme check` — validate the theme in the current directory. */
export function themeCheck(): number {
  const dir = resolve(process.cwd());
  if (!existsSync(join(dir, "theme.config.ts")) && !existsSync(join(dir, "theme.config.js"))) {
    console.error("No theme.config.ts here. Run `kurumera theme check` inside a theme directory.");
    return 1;
  }

  const res = checkTheme(dir);
  if (!res.findings.length) {
    console.log("✓ theme check passed — no issues.\n\nReady to push.");
    return 0;
  }

  const byCat = new Map<Category, Finding[]>();
  for (const f of res.findings) {
    const list = byCat.get(f.category) ?? [];
    list.push(f);
    byCat.set(f.category, list);
  }

  for (const cat of ORDER) {
    const list = byCat.get(cat);
    if (!list?.length) continue;
    console.log(`\n${LABEL[cat]}`);
    for (const f of list) {
      const mark = f.severity === "error" ? "✗" : "⚠";
      console.log(`  ${mark} ${f.message}${f.file ? `  (${f.file})` : ""}`);
      if (f.fix) console.log(`      → ${f.fix}`);
    }
  }

  console.log(`\n${res.errors} error${res.errors === 1 ? "" : "s"}, ${res.warnings} warning${res.warnings === 1 ? "" : "s"}.`);
  console.log(res.passed
    ? "\nNo blocking errors — ready to push (warnings are advisory)."
    : "\nFix the errors (✗) before pushing.");
  return res.passed ? 0 : 1;
}

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { checkTheme } from "../lib/themeCheck.js";

/** `kurumera theme check` — validate the theme in the current directory. */
export function themeCheck(): number {
  const dir = resolve(process.cwd());
  if (!existsSync(join(dir, "theme.config.ts")) && !existsSync(join(dir, "theme.config.js"))) {
    console.error("No theme.config.ts here. Run `kurumera theme check` inside a theme directory.");
    return 1;
  }

  const res = checkTheme(dir);

  if (!res.findings.length) {
    console.log("✓ theme check passed — no issues.");
    return 0;
  }

  for (const f of res.findings) {
    const mark = f.severity === "error" ? "✗" : "⚠";
    console.log(`${mark} [${f.rule}] ${f.message}${f.file ? `  (${f.file})` : ""}`);
  }
  console.log(`\n${res.errors} error${res.errors === 1 ? "" : "s"}, ${res.warnings} warning${res.warnings === 1 ? "" : "s"}.`);
  console.log(res.passed ? "\nReady to push." : "\nFix the errors above before pushing.");
  return res.passed ? 0 : 1;
}

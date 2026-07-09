import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyDir } from "../util/fs.js";

/** Locate the base theme template to clone from. */
function baseThemeDir(): string {
  if (process.env.KURUMERA_BASE_THEME) return process.env.KURUMERA_BASE_THEME;
  const here = fileURLToPath(import.meta.url); // dist/commands/init.js
  // Published package: the template is bundled at <pkg>/template.
  const bundled = resolve(here, "../../../template");
  if (existsSync(bundled)) return bundled;
  // Monorepo dev fallback: the base theme is a sibling of packages/.
  return resolve(here, "../../../../../base-theme");
}

export function themeInit(name?: string): number {
  if (!name) {
    console.error("Usage: kurumera theme init <name>");
    return 1;
  }
  const dest = resolve(process.cwd(), name);
  if (existsSync(dest)) {
    console.error(`A directory named "${name}" already exists here.`);
    return 1;
  }
  const src = baseThemeDir();
  if (!existsSync(src)) {
    console.error(`Base theme template not found at:\n  ${src}\nSet KURUMERA_BASE_THEME to its path.`);
    return 1;
  }

  copyDir(src, dest);

  // Rename the scaffolded package to the developer's theme.
  const pkgPath = join(dest, "package.json");
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    pkg.name = name;
    pkg.private = true;
    delete pkg.description;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  } catch {
    /* leave the template package.json as-is */
  }

  console.log(`✓ Created "${name}" from the Kurumera base theme.\n`);
  console.log("Next steps:");
  console.log(`  cd ${name}`);
  console.log("  npm install");
  console.log("  kurumera theme dev --store <your-store>");
  return 0;
}

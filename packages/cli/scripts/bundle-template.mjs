// Copy the canonical base theme into the CLI package as `template/`, so a
// globally-installed `@kurumera/cli` can scaffold it without the monorepo.
// Runs on build + prepack (before publish). The template is gitignored — it's
// generated, the source of truth is /base-theme.
import { cpSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../../base-theme");
const dest = resolve(here, "../template");

const SKIP = /(^|[\\/])(node_modules|\.next|dist|\.git|\.turbo)([\\/]|$)|\.tsbuildinfo$/;

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true, filter: (p) => !SKIP.test(p) });
console.log(`bundled base-theme → ${dest}`);

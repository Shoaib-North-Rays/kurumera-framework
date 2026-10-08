/**
 * Which local files a theme file imports.
 *
 * `theme upgrade` adds files from the template and leaves edited files alone,
 * and those two rules can contradict each other: a new component may import a
 * helper that only the NEWER version of a left-alone file exports. Add one
 * without the other and the theme stops compiling on a file nobody asked for.
 *
 * So we read the imports. This is deliberately not a parser — it recognises
 * the import forms the base theme actually uses and nothing else. A specifier
 * it cannot resolve is reported as unresolved, never guessed at, because the
 * only decision made from this is "skip, and say why".
 */

/** `@/x` and relative specifiers only — a bare specifier is an npm package. */
const LOCAL = /^(@\/|\.\.?\/)/;

const PATTERNS = [
  /\bimport\s+[^;'"]*?\bfrom\s*["']([^"']+)["']/g,   // import x from "y"
  /\bexport\s+[^;'"]*?\bfrom\s*["']([^"']+)["']/g,   // export { x } from "y"
  /\bimport\s*["']([^"']+)["']/g,                    // import "y"
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,          // await import("y")
];

/** Every local module specifier a source file references, deduplicated. */
export function localImports(source: string): string[] {
  const out = new Set<string>();
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    for (let m = re.exec(source); m; m = re.exec(source)) {
      if (LOCAL.test(m[1])) out.add(m[1]);
    }
  }
  return [...out];
}

/**
 * The npm packages a source file imports, by package name — `@scope/name` or
 * `name`, with any subpath dropped, so `@kurumera/storefront/client` and
 * `@kurumera/storefront` are one answer.
 *
 * Needed because a new file can require a package range the theme has not
 * moved to. That is the other half of the same failure: the file lands, the
 * symbol it imports does not exist in the installed version, and the build
 * breaks on a file the developer never asked for.
 */
export function packageImports(source: string): string[] {
  const out = new Set<string>();
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    for (let m = re.exec(source); m; m = re.exec(source)) {
      const spec = m[1];
      if (LOCAL.test(spec) || spec.startsWith("/")) continue;
      const parts = spec.split("/");
      out.add(spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]);
    }
  }
  return [...out];
}

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".css"];

/**
 * Turn a specifier into a repo-relative path, using `known` as the file system:
 * the set of paths the template declares. `@/` is the base theme's alias for
 * the project root, set in tsconfig.
 *
 * Returns null when nothing in `known` matches, which means the specifier
 * points outside the template and is not ours to reason about.
 */
export function resolveLocal(spec: string, fromRel: string, known: Set<string>): string | null {
  let path: string;
  if (spec.startsWith("@/")) {
    path = spec.slice(2);
  } else {
    const dir = fromRel.split("/").slice(0, -1);
    const parts = spec.split("/");
    for (const part of parts) {
      if (part === ".") continue;
      if (part === "..") dir.pop();
      else dir.push(part);
    }
    path = dir.join("/");
  }
  if (known.has(path)) return path;
  for (const ext of EXTENSIONS) if (known.has(path + ext)) return path + ext;
  for (const ext of EXTENSIONS) if (known.has(`${path}/index${ext}`)) return `${path}/index${ext}`;
  return null;
}

/**
 * The files in `candidates` that `rel` imports — "what this file needs from the
 * rest of the theme".
 */
export function dependsOn(source: string, rel: string, known: Set<string>): string[] {
  const out = new Set<string>();
  for (const spec of localImports(source)) {
    const target = resolveLocal(spec, rel, known);
    if (target && target !== rel) out.add(target);
  }
  return [...out];
}

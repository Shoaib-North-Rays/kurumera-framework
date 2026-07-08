import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SKIP = new Set(["node_modules", ".next", "dist", ".git", ".turbo", ".DS_Store"]);

/** Recursively copy a directory, skipping build/vcs artifacts. */
export function copyDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    if (SKIP.has(name) || name.endsWith(".tsbuildinfo")) continue;
    const s = join(src, name);
    const d = join(dest, name);
    if (statSync(s).isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

/** `npm` binary name for the current platform. */
export function npmBin(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

/** Parse `--key value` / `--key=value` flags from an argv slice. */
export function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
}

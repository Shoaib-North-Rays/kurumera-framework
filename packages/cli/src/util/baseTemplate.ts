/**
 * The template as it was when a theme was scaffolded — the third side of a
 * three-way merge.
 *
 * We do not keep a copy inside the theme. `.kurumera/baseline.json` records
 * which CLI version scaffolded it, every CLI version is on npm, and npm already
 * has to be present for any of this to work. So the base is fetched on demand
 * rather than duplicated into every repository.
 *
 * Cached under the user's own cache directory, because an upgrade of twelve
 * stores scaffolded on the same CLI should download that template once.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { npmBin } from "./fs.js";

function cacheRoot(): string {
  return process.env.KURUMERA_TEMPLATE_CACHE
    || join(homedir(), ".kurumera", "template-cache");
}

/**
 * The bundled template of `@kurumera/cli@<version>`, or null when it cannot be
 * had — an unpublished version, no network, npm missing. Null means "merge is
 * not available here", never "the theme has no history".
 */
export function baseTemplateFor(version: string): string | null {
  if (!version || version === "unknown") return null;
  const cached = join(cacheRoot(), version, "template");
  if (existsSync(cached)) return cached;

  const work = mkdtempSync(join(tmpdir(), "kurumera-base-"));
  try {
    const packed = spawnSync(npmBin(),
      ["pack", `@kurumera/cli@${version}`, "--pack-destination", work, "--silent"],
      { encoding: "utf8", shell: process.platform === "win32" });
    if (packed.status !== 0) return null;

    const tgz = readdirSync(work).find((f) => f.endsWith(".tgz"));
    if (!tgz) return null;

    // Extract inside the work directory so no absolute path reaches tar: GNU
    // tar reads a leading "C:\…" as a remote host and fails to connect.
    const out = spawnSync("tar", ["-xzf", tgz], { cwd: work, encoding: "utf8" });
    if (out.status !== 0) return null;

    const extracted = join(work, "package", "template");
    if (!existsSync(extracted)) return null;

    // Copy into the cache rather than returning the temp path: the `finally`
    // below removes the work directory, so anything left inside it is gone by
    // the time the caller reads a file. (This cost an evening once.)
    mkdirSync(join(cacheRoot(), version), { recursive: true });
    cpSync(extracted, cached, { recursive: true });
    return cached;
  } catch {
    return null;
  } finally {
    try { rmSync(work, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

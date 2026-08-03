import { readConfig } from "../util/config.js";
import { resolveAuthToken } from "../util/resolveAuthToken.js";

const PUSH_URL = (process.env.KURUMERA_PUSH_URL || "https://themekit.kurumera.com/_push").replace(/\/+$/, "");

interface VersionEntry {
  id: string;
  type: "code";
  live: boolean;
  archived?: boolean;
  theme?: string;
  name?: string;
  version?: string;
}

/**
 * `kurumera theme versions --store <slug>` — EVERY version this store has any
 * record of, newest first, with the id `theme rollback --version`/`theme
 * activate --version` expects. "hot" ones activate immediately; "archived"
 * ones only have their source retained and get rebuilt on demand when
 * activated (takes about as long as a fresh `theme push`). Every entry here
 * is inherently a code-theme build — this command has nothing to say about a
 * store currently in builder mode (see `kurumera status`/the dashboard for
 * that).
 */
export async function themeVersions(args: string[]): Promise<number> {
  const cfg = readConfig();
  const store = flag(args, "--store") || cfg.defaultStore;
  if (!store) {
    console.error("Which store? Pass --store <slug> (or `kurumera login`).");
    return 1;
  }
  const authToken = await resolveAuthToken();
  if (!authToken) {
    console.error("Not signed in. Run `kurumera login` first.");
    return 1;
  }

  let data: { versions?: VersionEntry[] };
  try {
    const res = await fetch(`${PUSH_URL}/versions?store=${encodeURIComponent(store)}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    data = (await res.json().catch(() => ({}))) as { versions?: VersionEntry[]; error?: string; detail?: string };
    if (!res.ok) {
      const err = data as { error?: string; detail?: string };
      console.error(`Failed (${res.status}): ${err.detail || err.error || "unknown error"}`);
      return 1;
    }
  } catch (e) {
    console.error(`Request failed: ${(e as Error).message}`);
    return 1;
  }

  const versions = data.versions || [];
  if (!versions.length) {
    console.log(`No retained versions for "${store}" — run \`kurumera theme push\` first.`);
    return 0;
  }

  const idW = Math.max(2, ...versions.map((v) => v.id.length));
  const verW = Math.max(7, ...versions.map((v) => (v.version || "").length));
  console.log(`${"ID".padEnd(idW)}  ${"VERSION".padEnd(verW)}  TYPE  LIVE  STATUS`);
  for (const v of versions) {
    const status = v.archived ? "archived (rebuilds on activate)" : "ready";
    console.log(`${v.id.padEnd(idW)}  ${(v.version || "").padEnd(verW)}  ${v.type.padEnd(4)}  ${(v.live ? "✓" : " ").padEnd(4)}  ${status}`);
  }
  if (versions.some((v) => v.archived)) {
    console.log("\nArchived versions still work with `theme activate --version <id>` — they just rebuild first (like a fresh `theme push`).");
  }
  return 0;
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
}

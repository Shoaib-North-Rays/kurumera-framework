import { readConfig } from "../util/config.js";
import { resolveAuthToken } from "../util/resolveAuthToken.js";

const PUSH_URL = (process.env.KURUMERA_PUSH_URL || "https://themekit.kurumera.com/_push").replace(/\/+$/, "");

/** `kurumera theme logs` — show the latest build/validation log for the store. */
export async function themeLogs(args: string[]): Promise<number> {
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
  try {
    // /_push/logs now requires auth (it previously had none — closed as part
    // of the CLI's remote-safe auth work, see push-service.mjs). This header
    // was also just plain missing before, a separate pre-existing bug.
    const res = await fetch(`${PUSH_URL}/logs?store=${encodeURIComponent(store)}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Couldn't fetch logs (${res.status}): ${body.trim() || "unknown error"}`);
      return 1;
    }
    const text = await res.text();
    console.log(text.trim());
  } catch (e) {
    console.error(`Couldn't fetch logs: ${(e as Error).message}`);
    return 1;
  }
  return 0;
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
}

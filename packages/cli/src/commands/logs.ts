import { readConfig } from "../util/config.js";

const PUSH_URL = (process.env.KURUMERA_PUSH_URL || "https://themekit.kurumera.com/_push").replace(/\/+$/, "");

/** `kurumera theme logs` — show the latest build/validation log for the store. */
export async function themeLogs(args: string[]): Promise<number> {
  const cfg = readConfig();
  const store = flag(args, "--store") || cfg.defaultStore;
  if (!store) {
    console.error("Which store? Pass --store <slug> (or `kurumera login`).");
    return 1;
  }
  try {
    const res = await fetch(`${PUSH_URL}/logs?store=${encodeURIComponent(store)}`);
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

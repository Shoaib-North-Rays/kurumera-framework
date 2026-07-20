import { spawn } from "node:child_process";
import { readConfig } from "../util/config.js";

const PUSH_URL = (process.env.KURUMERA_PUSH_URL || "https://themekit.kurumera.com/_push").replace(/\/+$/, "");

function openBrowser(url: string): void {
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url.replace(/&/g, "^&")], { stdio: "ignore", detached: true, windowsVerbatimArguments: true }).unref();
      return;
    }
    spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { stdio: "ignore", detached: true }).unref();
  } catch { /* printed as fallback */ }
}

/**
 * `kurumera theme preview` — poll the latest pushed build; when it's ready, open
 * the preview URL (the theme rendered against a live store, unpublished).
 */
export async function themePreview(args: string[]): Promise<number> {
  const cfg = readConfig();
  const store = flag(args, "--store") || cfg.defaultStore || "";
  if (!store) { console.error("Which store? Pass --store <slug> (or run `kurumera login`)."); return 1; }

  process.stdout.write("Waiting for the build");
  let previewUrl = "";
  let idle = 0;
  for (let i = 0; i < 60; i++) {
    let s: { status?: string; preview_url?: string; error?: string } = {};
    try {
      // Build status is keyed per store — without ?store= the server returns a
      // fresh "idle" forever and the poll always times out.
      const r = await fetch(`${PUSH_URL}/status?store=${encodeURIComponent(store)}`, { headers: cfg.authToken ? { Authorization: `Bearer ${cfg.authToken}` } : {} });
      s = (await r.json()) as typeof s;
    } catch { /* keep polling */ }
    if (s.status === "ready" && s.preview_url) { previewUrl = s.preview_url; break; }
    if (s.status === "failed") { console.error(`\nBuild failed: ${s.error || "see logs"}.`); return 1; }
    // No build was ever started (idle) — don't poll for 5 minutes; tell the user.
    if (s.status === "idle" || !s.status) {
      if (++idle >= 3) {
        console.error(
          "\nNo build in progress for this store.\n" +
            "  • Run `kurumera theme push` first — it builds, then `theme preview` shows it.\n" +
            `  • Or run \`kurumera theme dev --store ${store}\` for a fast local preview at http://localhost:3000`,
        );
        return 1;
      }
    } else idle = 0;
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 5000));
  }
  if (!previewUrl) { console.error("\nTimed out waiting for the build (it may still be building — retry `kurumera theme preview`)."); return 1; }

  const url = store ? `${previewUrl}${previewUrl.includes("?") ? "&" : "?"}store=${encodeURIComponent(store)}` : previewUrl;
  console.log(`\n✓ Preview ready:\n  ${url}`);
  openBrowser(url);
  return 0;
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
}

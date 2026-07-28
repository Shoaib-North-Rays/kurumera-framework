import { readConfig } from "../util/config.js";
import { resolveAuthToken } from "../util/resolveAuthToken.js";
import { startSpinner, green } from "../lib/spinner.js";
import { requestScopeAmend, tryCompletePendingAmend } from "../util/scopeAmend.js";

const PUSH_URL = (process.env.KURUMERA_PUSH_URL || "https://themekit.kurumera.com/_push").replace(/\/+$/, "");
const ROOT = process.env.KURUMERA_ROOT_DOMAIN || "kurumera.com";

interface MutationResult { error?: string; detail?: string; required_scope?: string; reverted?: string; version?: string }

/**
 * POST to a theme-mutation endpoint (publish/unpublish/rollback) with
 * `confirm: true` always set — the human/agent already typed this exact
 * command, which IS the explicit-intent signal the server's
 * `confirmation_required` gate asks for (there's no TTY to prompt on in the
 * sandboxed environments this CLI targets). Not a security boundary — see
 * ThemeAuthzView/scopes.DESTRUCTIVE_THEME_ACTIONS on the backend.
 *
 * On a `missing_scope` 403, transparently tries a just-approved pending
 * amendment first (so a simple re-run after approving in the browser just
 * works), then falls back to starting a new amendment request and exiting.
 */
async function mutate(
  path: string, authToken: string, body: Record<string, unknown>,
): Promise<{ status: number; data: MutationResult; retried: boolean }> {
  const attempt = async () => {
    const r = await fetch(`${PUSH_URL}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, confirm: true }),
    });
    return { status: r.status, data: (await r.json().catch(() => ({}))) as MutationResult };
  };

  let res = await attempt();
  if (res.status === 403 && res.data.error === "missing_scope") {
    const justGranted = await tryCompletePendingAmend();
    if (justGranted) return { ...(await attempt()), retried: true };
    if (res.data.required_scope) await requestScopeAmend(res.data.required_scope, authToken);
  }
  return { ...res, retried: false };
}

/**
 * `kurumera theme publish` — make the pushed code theme the store's LIVE theme
 * (shoppers on <slug>.kurumera.com see it). `--off` rolls back to the visual
 * builder. This is the StoreTheme mode switch — nothing is destroyed either way.
 */
export async function themePublish(args: string[]): Promise<number> {
  const cfg = readConfig();
  const authToken = await resolveAuthToken();
  if (!authToken) {
    console.error("Not signed in. Run `kurumera login` first.");
    return 1;
  }
  const store = flag(args, "--store") || cfg.defaultStore;
  if (!store) {
    console.error("Which store? Pass --store <slug>.");
    return 1;
  }
  const off = args.includes("--off");

  let res: { status: number; data: MutationResult; retried: boolean };
  try {
    res = await mutate(off ? "unpublish" : "publish", authToken, { store });
  } catch (e) {
    console.error(`Request failed: ${(e as Error).message}`);
    return 1;
  }
  if (res.status !== 200) {
    // mutate() already printed amend instructions for an unretried
    // missing_scope failure — don't pile a redundant generic error on top.
    if (res.status === 403 && res.data.error === "missing_scope" && !res.retried) return 1;
    console.error(`Failed (${res.status}): ${res.data.detail || res.data.error || "unknown error"}`);
    return 1;
  }

  if (off) {
    console.log(`✓ Unpublished — "${store}" is back on the visual builder.`);
    return 0;
  }

  console.log(`✓ Published — "${store}" now serves your code theme.`);
  // Don't just claim it — confirm the live site actually responds (the store
  // container may need a few seconds to (re)start / warm from scale-to-zero).
  const liveUrl = `https://${store}.${ROOT}`;
  const spin = startSpinner(["Waking your store", "Warming up", "Checking it responds"]);
  let liveOk = false;
  for (let i = 0; i < 16; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    try {
      const r = await fetch(liveUrl, { redirect: "manual" });
      if (r.status >= 200 && r.status < 400) { liveOk = true; break; }
    } catch { /* warming up — keep trying */ }
  }
  if (liveOk) {
    spin.stop(green(`✓ Live and serving — ${liveUrl}`));
  } else {
    spin.stop(`  ${liveUrl} — flipped live; give it a few seconds to warm up, then reload. Verify: kurumera theme preview --store ${store}`);
  }
  return 0;
}

/** `kurumera theme rollback` — restore the store's PREVIOUS live version. */
export async function themeRollback(args: string[]): Promise<number> {
  const cfg = readConfig();
  const authToken = await resolveAuthToken();
  if (!authToken) { console.error("Not signed in. Run `kurumera login` first."); return 1; }
  const store = flag(args, "--store") || cfg.defaultStore;
  if (!store) { console.error("Which store? Pass --store <slug>."); return 1; }

  let res: { status: number; data: MutationResult; retried: boolean };
  try {
    res = await mutate("rollback", authToken, { store });
  } catch (e) {
    console.error(`Request failed: ${(e as Error).message}`);
    return 1;
  }
  if (res.status !== 200) {
    if (res.status === 403 && res.data.error === "missing_scope" && !res.retried) return 1;
    console.error(`Failed (${res.status}): ${res.data.detail || res.data.error || "unknown error"}`);
    return 1;
  }
  console.log(`✓ "${store}" rolled back to ${res.data.reverted}${res.data.version ? ` (${res.data.version})` : ""}.`);
  console.log(`  Live: https://${store}.${ROOT}`);
  return 0;
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")) return args[i + 1];
  const eq = args.find((a) => a.startsWith(`${name}=`));
  return eq ? eq.slice(name.length + 1) : undefined;
}

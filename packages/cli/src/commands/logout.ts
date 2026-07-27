import { readConfig, writeConfig, CONFIG_PATH } from "../util/config.js";
import { flag } from "../util/fs.js";

const DEFAULT_API_URL = "https://admin.kurumera.com/api/v1";

/**
 * `kurumera logout` — clear saved credentials from ~/.kurumera/config.json.
 *
 *   kurumera logout                 Sign out fully (dev session + all storefront tokens)
 *   kurumera logout --store <slug>  Remove only that store's storefront token
 *
 * Best-effort revokes the server-side CLI session (device-flow / manual
 * `auth` token) first, with a short timeout — but ALWAYS proceeds to the
 * local cleanup regardless of whether that call succeeds; local logout must
 * never block on network reachability. The `--api-url` preference is kept —
 * it's an environment pointer, not a credential.
 */
export async function logout(args: string[]): Promise<number> {
  const cfg = readConfig();
  const store = flag(args, "--store");

  if (!store && cfg.auth?.accessToken) {
    await revokeServerSession(cfg.apiUrl, cfg.auth.accessToken).catch(() => { /* best-effort */ });
  }

  // Remove a single store's storefront token; leave the rest of the session intact.
  if (store) {
    if (cfg.stores && store in cfg.stores) {
      delete cfg.stores[store];
      if (Object.keys(cfg.stores).length === 0) delete cfg.stores;
      writeConfig(cfg);
      console.log(`✓ Removed the storefront token for "${store}".`);
    } else {
      console.log(`No saved storefront token for "${store}".`);
    }
    return 0;
  }

  const storeCount = cfg.stores ? Object.keys(cfg.stores).length : 0;
  if (!cfg.authToken && !cfg.refresh && !cfg.token && !cfg.defaultStore && !storeCount && !cfg.auth) {
    console.log("You're already signed out — no saved credentials.");
    return 0;
  }

  const cleared: string[] = [];
  if (cfg.authToken || cfg.refresh || cfg.auth) cleared.push("developer session");
  if (cfg.token || storeCount) cleared.push(`storefront token${cfg.token || storeCount > 1 ? "s" : ""}`);

  delete cfg.authToken;
  delete cfg.refresh;
  delete cfg.token;
  delete cfg.stores;
  delete cfg.defaultStore;
  delete cfg.auth;
  writeConfig(cfg);

  console.log(`✓ Signed out${cleared.length ? ` — cleared ${cleared.join(" + ")}` : ""}.`);
  console.log(`  (${CONFIG_PATH})`);
  console.log("  Sign back in with: kurumera login");
  return 0;
}

/** Best-effort server-side revoke — short timeout, NEVER throws past its own
 *  boundary (the caller already wraps this in .catch as a second layer). */
async function revokeServerSession(apiUrl: string | undefined, accessToken: string): Promise<void> {
  const url = `${(apiUrl || DEFAULT_API_URL).replace(/\/+$/, "")}/cli/device/revoke/`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: accessToken }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

import { readConfig, writeConfig, CONFIG_PATH } from "../util/config.js";
import { flag } from "../util/fs.js";

/**
 * `kurumera logout` — clear saved credentials from ~/.kurumera/config.json.
 *
 *   kurumera logout                 Sign out fully (dev session + all storefront tokens)
 *   kurumera logout --store <slug>  Remove only that store's storefront token
 *
 * Local-only: this just deletes saved tokens, it never calls the server. The
 * `--api-url` preference is kept — it's an environment pointer, not a credential.
 */
export async function logout(args: string[]): Promise<number> {
  const cfg = readConfig();
  const store = flag(args, "--store");

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
  if (!cfg.authToken && !cfg.refresh && !cfg.token && !cfg.defaultStore && !storeCount) {
    console.log("You're already signed out — no saved credentials.");
    return 0;
  }

  const cleared: string[] = [];
  if (cfg.authToken || cfg.refresh) cleared.push("developer session");
  if (cfg.token || storeCount) cleared.push(`storefront token${cfg.token || storeCount > 1 ? "s" : ""}`);

  delete cfg.authToken;
  delete cfg.refresh;
  delete cfg.token;
  delete cfg.stores;
  delete cfg.defaultStore;
  writeConfig(cfg);

  console.log(`✓ Signed out${cleared.length ? ` — cleared ${cleared.join(" + ")}` : ""}.`);
  console.log(`  (${CONFIG_PATH})`);
  console.log("  Sign back in with: kurumera login");
  return 0;
}

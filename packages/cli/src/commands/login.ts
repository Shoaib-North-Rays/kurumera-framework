import { readConfig, writeConfig, CONFIG_PATH } from "../util/config.js";
import { flag } from "../util/fs.js";

/**
 * P1 login: save a storefront token so `theme dev` can pick it up without
 * re-passing it. Per-store when `--store` is given, else the default token.
 *
 * (The full browser/device-code developer login — for `theme push`/`publish` —
 * lands in P2. This keeps the local dev loop working today.)
 */
export function login(args: string[]): number {
  const token = flag(args, "--token");
  const store = flag(args, "--store");
  const apiUrl = flag(args, "--api-url");

  if (!token) {
    console.error(
      "Save a storefront token for local dev:\n" +
        "  kurumera login --store <slug> --token ksf_…\n\n" +
        "Get one in the dashboard → Settings → Developer.\n" +
        "Browser login for push/publish arrives in P2.",
    );
    return 1;
  }
  if (!token.startsWith("ksf_")) {
    console.error("That doesn't look like a storefront token (expected a `ksf_…` value).");
    return 1;
  }

  const cfg = readConfig();
  if (apiUrl) cfg.apiUrl = apiUrl;
  if (store) {
    cfg.stores = { ...cfg.stores, [store]: token };
    console.log(`✓ Saved storefront token for "${store}".`);
  } else {
    cfg.token = token;
    console.log("✓ Saved default storefront token.");
  }
  writeConfig(cfg);
  console.log(`  (${CONFIG_PATH})`);
  return 0;
}

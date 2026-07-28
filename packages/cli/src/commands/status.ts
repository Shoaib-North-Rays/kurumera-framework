import { readConfig } from "../util/config.js";
import { resolveAuthToken } from "../util/resolveAuthToken.js";
import { resolveAuthUrl } from "../util/authUrl.js";

interface SessionMe {
  id?: string;
  name?: string;
  scopes?: string[];
  created_via?: string;
  authorized_stores?: string[];
  access_expires_at?: string | null;
  last_used_at?: string | null;
}

/**
 * `kurumera status` (alias `kurumera whoami`) — sanitized connection status:
 * name, granted scopes, authorized stores, expiry. NEVER prints the access
 * or refresh token itself, only what it's authorized to do.
 */
export async function status(): Promise<number> {
  if (process.env.KURUMERA_CLI_TOKEN) {
    console.log("Signed in with KURUMERA_CLI_TOKEN (standing token from the environment).");
    console.log("This takes priority over any saved login — `unset KURUMERA_CLI_TOKEN` to see the saved one instead.");
    return 0;
  }

  const cfg = readConfig();
  if (!cfg.auth?.accessToken) {
    if (cfg.authToken) {
      console.log("Signed in via the browser (loopback) flow.");
      if (cfg.defaultStore) console.log(`Default store: ${cfg.defaultStore}`);
      return 0;
    }
    console.log("Not signed in.");
    console.log("  kurumera login");
    return 1;
  }

  const authToken = await resolveAuthToken();
  if (!authToken) {
    console.log("Not signed in.");
    return 1;
  }

  let me: SessionMe | undefined;
  try {
    const base = resolveAuthUrl().replace(/\/+$/, "");
    const res = await fetch(`${base}/cli/session/me/`, { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.ok) me = (await res.json()) as SessionMe;
  } catch {
    /* fall through to the locally-cached view below */
  }

  if (!me) {
    console.log("Signed in (device flow) — couldn't reach the server to confirm current details.");
    console.log(`Locally cached scopes: ${(cfg.auth.scopes || []).join(", ") || "(none)"}`);
    return 0;
  }

  console.log(`Connection: ${me.name || "kurumera login"}`);
  console.log(`Type:       ${me.created_via === "manual" ? "CI token" : "Device login"}`);
  console.log(`Scopes:     ${(me.scopes || []).join(", ") || "(none)"}`);
  const stores = me.authorized_stores || [];
  console.log(`Stores:     ${stores.length ? stores.join(", ") : "(none — kurumera stores add <slug>)"}`);
  console.log(`Expires:    ${me.access_expires_at ? new Date(me.access_expires_at).toLocaleString() : "auto-refreshing"}`);
  console.log(`Last used:  ${me.last_used_at ? new Date(me.last_used_at).toLocaleString() : "just now"}`);
  return 0;
}

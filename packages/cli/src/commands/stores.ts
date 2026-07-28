import { readConfig } from "../util/config.js";
import { resolveAuthToken } from "../util/resolveAuthToken.js";
import { resolveAuthUrl } from "../util/authUrl.js";

interface SessionMe {
  id?: string;
  name?: string;
  scopes?: string[];
  authorized_stores?: string[];
  created_via?: string;
}

/**
 * `kurumera stores list` — the stores this connection can act on.
 *
 * Bug fix: this used to read ONLY `cfg.defaultStore`/`cfg.stores` — fields
 * the LOOPBACK BROWSER flow and manual `--store --token` save populate, but
 * the DEVICE flow never touches. A developer who signed in with
 * `kurumera login --device` (the default in any remote/headless/sandboxed
 * environment — see util/environment.ts) would see "No stores yet" here
 * even with a perfectly valid, server-authorized session, while
 * `theme push --store <slug>` succeeded — the exact inconsistency this
 * fixes. Now: when a device/manual session is active, ask the server what
 * IT actually authorizes (GET /cli/session/me/) instead of guessing from
 * local fields that flow never wrote.
 */
export async function storesList(): Promise<number> {
  const cfg = readConfig();

  if (cfg.auth?.accessToken) {
    const authToken = await resolveAuthToken();
    if (authToken) {
      const me = await fetchSessionMe(authToken);
      if (me) {
        const stores = me.authorized_stores || [];
        if (!stores.length) {
          console.log("This connection has no authorized stores yet.");
          console.log("  Add one: kurumera stores add <slug>");
          return 0;
        }
        console.log(`Your stores (${me.name || "this connection"})\n`);
        for (const slug of stores) console.log(`  ${slug.padEnd(24)} authorized`);
        console.log("\nTarget any with --store <slug>; its storefront is <slug>.kurumera.com.");
        console.log("Add another: kurumera stores add <slug>");
        return 0;
      }
      // Couldn't reach the server — fall through to the local echo below
      // rather than claiming "no stores" outright; it's stale but truthful
      // about what THIS machine has cached.
      console.error("(Couldn't confirm authorized stores with the server — showing locally cached info.)");
    }
  }

  const rows: { slug: string; note: string }[] = [];
  if (cfg.defaultStore) rows.push({ slug: cfg.defaultStore, note: "default (from login)" });
  for (const slug of Object.keys(cfg.stores || {})) {
    if (slug === cfg.defaultStore) continue;
    rows.push({ slug, note: "storefront token" });
  }

  if (!rows.length) {
    console.log("No stores yet.");
    console.log("  Sign in:        kurumera login");
    console.log("  Or add a token: kurumera login --store <slug> --token ksf_…");
    return 0;
  }

  console.log("Your stores\n");
  for (const r of rows) console.log(`  ${r.slug.padEnd(24)} ${r.note}`);
  console.log("\nTarget any with --store <slug>; its storefront is <slug>.kurumera.com.");
  return 0;
}

/**
 * `kurumera stores add <slug>` — request this connection be authorized for
 * another store, without a new login. One request, no polling — approve in
 * the browser, then just start using `--store <slug>`.
 */
export async function storesAdd(slug: string | undefined): Promise<number> {
  if (!slug) {
    console.error("Which store? kurumera stores add <slug>");
    return 1;
  }
  const cfg = readConfig();
  if (!cfg.auth?.accessToken) {
    console.error("This only works for a `kurumera login --device` connection. Run `kurumera login` first.");
    return 1;
  }
  const authToken = await resolveAuthToken();
  if (!authToken) {
    console.error("Not signed in. Run `kurumera login` first.");
    return 1;
  }

  const me = await fetchSessionMe(authToken);
  if (!me?.id) {
    console.error("Couldn't resolve this connection's session — try `kurumera login` again.");
    return 1;
  }
  if (me.authorized_stores?.includes(slug)) {
    console.log(`✓ Already authorized for "${slug}".`);
    return 0;
  }

  const base = resolveAuthUrl().replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/cli/sessions/${me.id}/stores/request/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ store: slug }),
    });
  } catch (e) {
    console.error(`Request failed: ${(e as Error).message}`);
    return 1;
  }
  const body = (await res.json().catch(() => ({}))) as {
    device_code?: string; user_code?: string; verification_uri?: string; verification_uri_complete?: string;
    error?: string; error_description?: string;
  };
  if (!res.ok || !body.user_code) {
    if (body.error === "already_authorized") {
      console.log(`✓ Already authorized for "${slug}".`);
      return 0;
    }
    console.error(`Could not request "${slug}": ${body.error_description || body.error || `HTTP ${res.status}`}`);
    return 1;
  }

  console.log(`Open this URL in any browser to authorize "${slug}" for this connection:\n`);
  console.log(`  ${body.verification_uri_complete || body.verification_uri}\n`);
  console.log(`Code: ${body.user_code}\n`);
  console.log(`After approving, "${slug}" is ready to use — no new login needed.`);
  return 0;
}

async function fetchSessionMe(authToken: string): Promise<SessionMe | undefined> {
  try {
    const base = resolveAuthUrl().replace(/\/+$/, "");
    const res = await fetch(`${base}/cli/session/me/`, { headers: { Authorization: `Bearer ${authToken}` } });
    if (!res.ok) return undefined;
    return (await res.json()) as SessionMe;
  } catch {
    return undefined;
  }
}

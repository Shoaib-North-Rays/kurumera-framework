import { createKurumeraClient } from "@kurumera/storefront";

/**
 * The store client, wired from env. `kurumera theme dev` injects these:
 *   KURUMERA_STOREFRONT_TOKEN  the read-only ksf_ token for the target store (prod)
 *   KURUMERA_TENANT            dev-only: resolve the store by slug (X-Tenant-ID)
 *   KURUMERA_API_URL           platform API base (defaults to production)
 *
 * Server-only — never expose the token to the browser.
 */
const token = process.env.KURUMERA_STOREFRONT_TOKEN;
const tenant = process.env.KURUMERA_TENANT;

if (!token && !tenant) {
  // Fail loud so a missing credential is obvious, not a silent empty store.
  throw new Error(
    "No store credential. Run `kurumera theme dev --store <slug>` (dev) or " +
      "provide KURUMERA_STOREFRONT_TOKEN.",
  );
}

export const kurumera = createKurumeraClient({
  token,
  tenant,
  apiUrl: process.env.KURUMERA_API_URL,
});

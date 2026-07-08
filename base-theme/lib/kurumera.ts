import { createKurumeraClient } from "@kurumera/storefront";

/**
 * The store client, wired from env. `kurumera theme dev` injects these:
 *   KURUMERA_STOREFRONT_TOKEN  the read-only ksf_ token for the target store
 *   KURUMERA_API_URL           platform API base (defaults to production)
 *
 * Server-only — never expose the token to the browser.
 */
const token = process.env.KURUMERA_STOREFRONT_TOKEN;

if (!token) {
  // Fail loud in dev so a missing token is obvious, not a silent empty store.
  throw new Error(
    "KURUMERA_STOREFRONT_TOKEN is not set. Run `kurumera theme dev --store <slug>`, " +
      "or add the token to .env.local.",
  );
}

export const kurumera = createKurumeraClient({
  token,
  apiUrl: process.env.KURUMERA_API_URL,
});

import { headers } from "next/headers";
import { createKurumeraClient, type KurumeraClient } from "@kurumera/storefront";
import { makeDemoFetch, DEMO_TENANT } from "./demo-fetch";

/** The marketplace-preview container (and only it) runs with KURUMERA_DEMO=1. */
const IS_DEMO = process.env.KURUMERA_DEMO === "1";

/**
 * Build a Storefront client for THIS request's store. The store is resolved by
 * middleware.ts from the host (or ?store=) and passed via request headers, so a
 * single deployed theme serves every store — visitors connect to a live store,
 * not a predefined one.
 *
 * Env fallbacks keep local single-store dev working:
 *   KURUMERA_STOREFRONT_TOKEN  a ksf_ token (pins one store)
 *   KURUMERA_TENANT            a store slug (pins one store)
 *   KURUMERA_API_URL           platform API base
 */
export async function getStore(): Promise<KurumeraClient> {
  // Marketplace preview: KURUMERA_DEMO=1 (set only on the preview container by the
  // push-service) serves the seeded demo catalogue through the real SDK pipeline —
  // no live merchant is contacted. Customise the data in lib/demo-data.ts. Live
  // storefronts never set this flag, so they're unaffected.
  if (IS_DEMO) return createKurumeraClient({ tenant: DEMO_TENANT, fetch: makeDemoFetch() });

  const h = await headers();
  const tenant = h.get("x-kurumera-tenant") || process.env.KURUMERA_TENANT || "";
  const domain = h.get("x-kurumera-domain") || "";
  const token = process.env.KURUMERA_STOREFRONT_TOKEN || "";

  if (!token && !tenant && !domain) {
    throw new Error(
      "No store resolved for this request. Visit a store host (<slug>.kurumera.com), " +
        "add ?store=<slug>, or set KURUMERA_TENANT / KURUMERA_STOREFRONT_TOKEN.",
    );
  }

  return createKurumeraClient({
    token: token || undefined,
    tenant: tenant || undefined,
    domain: domain || undefined,
    apiUrl: process.env.KURUMERA_API_URL,
  });
}

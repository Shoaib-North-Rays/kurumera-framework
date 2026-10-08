import { headers } from "next/headers";
import { cache } from "react";
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

/**
 * This store's `/storefront/tenant-config/` response (branding + resolved
 * tenant identity) — fetched once per request via React's `cache()` and shared
 * by every caller (getSettings(), getTenantSlug()) instead of each firing its
 * own request.
 */
export const getStoreConfig = cache(async (): Promise<Record<string, unknown>> => {
  try {
    const kurumera = await getStore();
    return (await kurumera.config.get()) as Record<string, unknown>;
  } catch {
    return {};
  }
});

let warnedNoTenant = false;

/**
 * On `localhost` nothing injects the tenant headers that the proxy sets in
 * production, so the slug resolves to "" — and everything keyed on it goes
 * quiet, analytics included. Silence there is indistinguishable from a broken
 * feature or a mis-wired theme, which costs an afternoon to tell apart.
 *
 * So in development only, fall back to KURUMERA_TENANT (the variable themes
 * already set in `.env.local` for `theme dev`), and say once what happened
 * when there is nothing to fall back to. Never in production: there the slug
 * must come from the request, or one store would render as another.
 */
function devTenantSlug(): string {
  if (process.env.NODE_ENV === "production") return "";
  const slug = process.env.KURUMERA_TENANT || "";
  if (!warnedNoTenant) {
    warnedNoTenant = true;
    console.warn(slug
      ? `[kurumera] no tenant header; using KURUMERA_TENANT=${slug} (development only)`
      : "[kurumera] no tenant resolved — analytics and client-side commerce are disabled. Set KURUMERA_TENANT in .env.local.");
  }
  return slug;
}

/**
 * The tenant slug for THIS request, for the BROWSER (`window.__TENANT__`,
 * injected by the root layout). Client-side commerce (cart, account) calls the
 * platform API directly from the browser — cross-origin — so it can't see the
 * `x-kurumera-domain` header middleware.ts resolved server-side; it needs its
 * own copy of the slug. A subdomain host already carries its slug in the
 * header (no network round trip needed); a custom domain only resolves to one
 * via the tenant-config response getSettings() is already fetching this
 * request, so this never costs a second fetch.
 */
export async function getTenantSlug(): Promise<string> {
  if (IS_DEMO) return DEMO_TENANT;
  const h = await headers();
  const direct = h.get("x-kurumera-tenant");
  if (direct) return direct;
  if (!h.get("x-kurumera-domain")) return devTenantSlug();
  const cfg = await getStoreConfig();
  const tenant = (cfg?.tenant && typeof cfg.tenant === "object" ? cfg.tenant : {}) as Record<string, unknown>;
  return typeof tenant.slug === "string" ? tenant.slug : "";
}

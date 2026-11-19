import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { getStoreConfig } from "./kurumera";

/**
 * Consolidate a store onto its own domain for search engines.
 *
 * One deployed theme serves every store on several hosts: the merchant's own
 * custom domain (theplantsmall.com), the platform subdomain (<slug>.kurumera.com
 * / <slug>.shop.kurumera.com) and the ?store= demo override on themekit. When a
 * store has a live custom domain, the platform hosts are duplicate copies of it.
 * Each page already sends `rel=canonical` to the custom domain, but a canonical
 * is only a hint; a crawlable 200 on the platform host can still be indexed
 * (SEV-16). A 308 to the custom domain is the unambiguous signal, and it keeps a
 * human who lands on the old host on the right one too.
 *
 * Only redirects when ALL hold, so no legitimate surface moves:
 *   - the host is a platform host under the root domain (never the custom
 *     domain itself, never localhost);
 *   - the render is not the admin content editor (edit token) and not a
 *     ?store= demo/preview (middleware flags it with x-kurumera-preview);
 *   - the store has a live custom domain in tenant-config (no domain => the
 *     platform subdomain IS the store's canonical home — nothing to move to),
 *     and that domain is itself not a platform host (no redirect loop).
 *
 * The custom domain comes from the tenant-config the layout already fetched this
 * request (React cache()), so this costs no extra call. Must be awaited from the
 * root layout BEFORE anything renders.
 */
const ROOT = (process.env.KURUMERA_ROOT_DOMAIN || "kurumera.com").toLowerCase();

export async function maybeRedirectToCanonicalDomain(): Promise<void> {
  // The marketplace preview container (fake tenant, no custom domain) never
  // redirects — same single switch the analytics/SDK code keys on.
  if (process.env.KURUMERA_DEMO === "1") return;

  const h = await headers();
  const host = (h.get("host") || "").split(":")[0].toLowerCase();

  // Only platform hosts under the root domain are duplicates to consolidate.
  // A merchant's own custom domain (and localhost) end elsewhere — left alone.
  if (!host.endsWith(`.${ROOT}`)) return;

  // Never redirect an editor or preview render.
  if (h.get("x-kurumera-edit-token") || h.get("x-kurumera-preview")) return;

  // The store's own live custom domain, from the tenant-config already fetched
  // this request. No domain => this platform subdomain is the canonical home.
  const cfg = await getStoreConfig();
  const tenant = (cfg?.tenant && typeof cfg.tenant === "object" ? cfg.tenant : {}) as { domain?: unknown };
  const domain = typeof tenant.domain === "string" ? tenant.domain.trim().toLowerCase() : "";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return;
  // Already canonical, or the configured domain is itself a platform host:
  // either way a redirect would be a no-op or a loop. Leave it.
  if (domain === host || domain.endsWith(`.${ROOT}`) || domain === ROOT) return;

  // Path only (both middleware spellings), so ?world= and other query variants
  // collapse to the one clean address — the same URL the canonical names.
  const path = h.get("x-kurumera-pathname") || h.get("x-plants-mall-pathname") || "/";
  // 308: permanent + method-preserving. Google moves the duplicate platform
  // host's result to the merchant's own domain.
  permanentRedirect(`https://${domain}${path}`);
}

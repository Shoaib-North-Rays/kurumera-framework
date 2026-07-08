import type { Http } from "../http.js";
import type { TenantConfig } from "../types.js";

export function configResource(http: Http) {
  return {
    /** GET /storefront/tenant-config/ — branding, colors, contact, SEO defaults. */
    get: () => http.get<TenantConfig>("/storefront/tenant-config/"),
  };
}

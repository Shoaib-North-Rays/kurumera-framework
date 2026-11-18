import type { Http } from "../http.js";
import type { TenantConfig, WhatsAppChat } from "../types.js";

export function configResource(http: Http) {
  return {
    /** GET /storefront/tenant-config/ — branding, colors, contact, SEO defaults. */
    get: () => http.get<TenantConfig>("/storefront/tenant-config/"),
  };
}

/**
 * The store's floating WhatsApp button from a tenant-config response, or null
 * when there is nothing to draw: the merchant has it off, the number cannot
 * take messages, or the platform is older than the setting.
 *
 * Only ever a `https://wa.me/` link, so a theme can render it as an anchor
 * without checking the destination itself.
 *
 * ```tsx
 * const chat = whatsappChat(await kurumera.config.get());
 * {chat && <a href={chat.href} target="_blank" rel="noopener noreferrer" aria-label={chat.label}>…</a>}
 * ```
 */
export function whatsappChat(config: TenantConfig | null | undefined): WhatsAppChat | null {
  const raw = config?.whatsapp_chat as unknown;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const href = typeof r.href === "string" ? r.href : "";
  if (r.enabled !== true || !href.startsWith("https://wa.me/")) return null;
  return {
    enabled: true,
    href,
    label: typeof r.label === "string" && r.label ? r.label : "Message us on WhatsApp",
  };
}

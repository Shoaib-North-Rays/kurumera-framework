/**
 * @kurumera/storefront — typed Storefront SDK for Kurumera Next.js themes.
 *
 *   import { createKurumeraClient } from "@kurumera/storefront";
 *
 *   const kurumera = createKurumeraClient({ token: process.env.KURUMERA_STOREFRONT_TOKEN! });
 *   const products = await kurumera.products.list({ limit: 12 });
 *   const product  = await kurumera.products.getByHandle("black-shirt");
 *   const menus    = await kurumera.navigation.all();
 *   const cart     = await kurumera.cart.create();
 *
 * The token is a read-only `ksf_…` storefront token; the backend resolves the
 * store from it, so the same client works in local dev and in production.
 */
import { createHttp, type ClientConfig, type Http } from "./http.js";
import { productsResource } from "./resources/products.js";
import { collectionsResource } from "./resources/collections.js";
import { searchResource } from "./resources/search.js";
import { pagesResource } from "./resources/pages.js";
import { navigationResource } from "./resources/navigation.js";
import { configResource } from "./resources/config.js";
import { cartResource } from "./resources/cart.js";
import { contentResource } from "./resources/content.js";
import { formsResource } from "./resources/forms.js";
import { discountsResource } from "./resources/discounts.js";
import { contactResource } from "./resources/contact.js";

export * from "./types.js";
/**
 * Storefront analytics. Browser-only and framework-agnostic — safe to import
 * from a Server Component file; every entry point no-ops without a `window`.
 */
export { trackEvent, EVENT, resolveTenantSlug, analyticsIdentity, sessionUtm } from "./analytics.js";
export type { TrackOptions } from "./analytics.js";
export { KurumeraError, DEFAULT_API_URL, collectAll } from "./http.js";
export type { ClientConfig, Http } from "./http.js";
export type { NewLine } from "./resources/cart.js";
/** Merchant-defined forms — the field schema a theme renders, and the submit. */
export { formFieldErrors } from "./resources/forms.js";
export type {
  FormDefinition, FormFieldDef, FormSubmitResult, FormValue,
} from "./resources/forms.js";
/** Discount codes — check one before checkout rather than at it. */
export type { DiscountValidation } from "./resources/discounts.js";
/**
 * The store's built-in contact form. `contactFields()` returns the merchant's
 * admin settings in the same shape a built form uses, so one component renders
 * either.
 */
export { contactFields, DEFAULT_CONTACT_CONFIG } from "./resources/contact.js";
export type {
  ContactConfig, ContactDetails, ContactFieldRule, ContactFormRules,
  ContactSubmission, ContactSubmitResult,
} from "./resources/contact.js";

export interface KurumeraClient {
  products: ReturnType<typeof productsResource>;
  collections: ReturnType<typeof collectionsResource>;
  search: ReturnType<typeof searchResource>;
  pages: ReturnType<typeof pagesResource>;
  navigation: ReturnType<typeof navigationResource>;
  config: ReturnType<typeof configResource>;
  cart: ReturnType<typeof cartResource>;
  /** Kurumera Editable Components — merchant-editable inline content. */
  content: ReturnType<typeof contentResource>;
  /** Merchant-defined forms: fetch the field schema, submit the answers. */
  forms: ReturnType<typeof formsResource>;
  /** Discount codes: validate one early, without applying it. */
  discounts: ReturnType<typeof discountsResource>;
  /**
   * The contact form every store has, whether or not the merchant built one.
   * Use `forms` for a merchant-defined form; this is the fallback and the
   * platform's own endpoint behind it.
   */
  contact: ReturnType<typeof contactResource>;
  /** Escape hatch: call any storefront endpoint the typed resources don't cover. */
  http: Http;
}

export function createKurumeraClient(config: ClientConfig): KurumeraClient {
  const http = createHttp(config);
  return {
    products: productsResource(http),
    collections: collectionsResource(http),
    search: searchResource(http),
    pages: pagesResource(http),
    navigation: navigationResource(http),
    config: configResource(http),
    cart: cartResource(http),
    content: contentResource(http),
    forms: formsResource(http),
    discounts: discountsResource(http),
    contact: contactResource(http),
    http,
  };
}

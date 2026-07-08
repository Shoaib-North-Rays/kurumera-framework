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

export * from "./types.js";
export { KurumeraError, DEFAULT_API_URL, collectAll } from "./http.js";
export type { ClientConfig, Http } from "./http.js";
export type { NewLine } from "./resources/cart.js";

export interface KurumeraClient {
  products: ReturnType<typeof productsResource>;
  collections: ReturnType<typeof collectionsResource>;
  search: ReturnType<typeof searchResource>;
  pages: ReturnType<typeof pagesResource>;
  navigation: ReturnType<typeof navigationResource>;
  config: ReturnType<typeof configResource>;
  cart: ReturnType<typeof cartResource>;
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
    http,
  };
}

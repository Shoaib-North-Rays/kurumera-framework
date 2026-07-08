import type { Http } from "../http.js";
import type { Paginated, Product, ProductListItem, ProductListParams } from "../types.js";

const enc = encodeURIComponent;

export function productsResource(http: Http) {
  return {
    /** GET /storefront/products/ — paged list of card-sized products. */
    list: (params?: ProductListParams) =>
      http.get<Paginated<ProductListItem>>("/storefront/products/", params),

    /** GET /storefront/products/<handle>/ — full product detail (PDP). */
    getByHandle: (handle: string) =>
      http.get<Product>(`/storefront/products/${enc(handle)}/`),

    /** GET /storefront/best-sellers/ */
    bestSellers: (params?: ProductListParams) =>
      http.get<Paginated<ProductListItem>>("/storefront/best-sellers/", params),

    /** GET /storefront/deals/ */
    deals: (params?: ProductListParams) =>
      http.get<Paginated<ProductListItem>>("/storefront/deals/", params),
  };
}

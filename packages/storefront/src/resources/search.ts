import type { Http } from "../http.js";
import type { Paginated, ProductListItem, SearchParams } from "../types.js";

export function searchResource(http: Http) {
  return {
    /** GET /storefront/search/?q=… */
    query: (q: string, params?: SearchParams) =>
      http.get<Paginated<ProductListItem>>("/storefront/search/", { q, ...params }),

    /** GET /storefront/search/autocomplete/?q=… */
    autocomplete: (q: string) =>
      http.get<unknown>("/storefront/search/autocomplete/", { q }),
  };
}

import type { Http } from "../http.js";
import type { SearchParams, SearchResults } from "../types.js";

export function searchResource(http: Http) {
  return {
    /** GET /storefront/search/?q=… — cross-entity (products + collections), not a Paginated<T> page. */
    query: (q: string, params?: SearchParams) =>
      http.get<SearchResults>("/storefront/search/", { q, ...params }),

    /** GET /storefront/search/autocomplete/?q=… */
    autocomplete: (q: string) =>
      http.get<unknown>("/storefront/search/autocomplete/", { q }),
  };
}

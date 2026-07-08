import type { Http } from "../http.js";
import type { Collection, CollectionDetail, Paginated, ProductListParams } from "../types.js";

const enc = encodeURIComponent;

export function collectionsResource(http: Http) {
  return {
    /** GET /storefront/collections/ */
    list: (params?: ProductListParams) =>
      http.get<Paginated<Collection>>("/storefront/collections/", params),

    /** GET /storefront/collections/<handle>/ — collection + its products. */
    getByHandle: (handle: string) =>
      http.get<CollectionDetail>(`/storefront/collections/${enc(handle)}/`),

    /** GET /storefront/collections/by-slot/<slot>/ — merchandising slot lookup. */
    getBySlot: (slot: string) =>
      http.get<CollectionDetail>(`/storefront/collections/by-slot/${enc(slot)}/`),
  };
}

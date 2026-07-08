import type { Http } from "../http.js";
import type { Menu } from "../types.js";

interface MenusResponse {
  menus: Record<string, Menu>;
}

export function navigationResource(http: Http) {
  return {
    /** GET /storefront/menus/ — every menu keyed by handle, hrefs resolved. */
    all: async (): Promise<Record<string, Menu>> =>
      (await http.get<MenusResponse>("/storefront/menus/")).menus,

    /** One menu by handle (e.g. "main-menu", "footer"), or null if absent. */
    get: async (handle: string): Promise<Menu | null> =>
      (await http.get<MenusResponse>("/storefront/menus/")).menus[handle] ?? null,
  };
}

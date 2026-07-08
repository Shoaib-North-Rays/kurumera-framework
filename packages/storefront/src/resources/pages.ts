import type { Http } from "../http.js";
import type { CmsPage } from "../types.js";

const enc = encodeURIComponent;

export function pagesResource(http: Http) {
  return {
    /** GET /storefront/pages/<handle>/ — a CMS page's content. */
    getByHandle: (handle: string) =>
      http.get<CmsPage>(`/storefront/pages/${enc(handle)}/`),
  };
}

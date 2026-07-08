import type { Http } from "../http.js";
import type { Cart } from "../types.js";

const enc = encodeURIComponent;

export interface NewLine {
  variant_id: string;
  quantity?: number;
  [k: string]: unknown;
}

export function cartResource(http: Http) {
  return {
    /** POST /cart/ — start a new cart; returns its token. */
    create: () => http.post<Cart>("/cart/", {}),

    /** GET /cart/<token>/ */
    get: (token: string) => http.get<Cart>(`/cart/${enc(token)}/`),

    /** POST /cart/<token>/lines/ — add a variant. */
    addLine: (token: string, line: NewLine) =>
      http.post<Cart>(`/cart/${enc(token)}/lines/`, line),

    /** PATCH /cart/<token>/lines/<lineId>/ — change quantity. */
    updateLine: (token: string, lineId: string, patch: { quantity: number }) =>
      http.patch<Cart>(`/cart/${enc(token)}/lines/${enc(lineId)}/`, patch),

    /** DELETE /cart/<token>/lines/<lineId>/ */
    removeLine: (token: string, lineId: string) =>
      http.del<Cart>(`/cart/${enc(token)}/lines/${enc(lineId)}/`),
  };
}

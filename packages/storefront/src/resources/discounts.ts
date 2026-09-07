/**
 * Discount codes.
 *
 * A code could only ever be checked when the order was placed, so a shopper
 * typed one into a cart, got nothing back, and found out it had expired after
 * filling in an address and a card. This checks early.
 *
 * It applies nothing. No usage is consumed and the answer is not a promise —
 * the order endpoint re-validates against the real, server-side cart when it
 * matters. What you get is an honest "yes, that works, and it takes off X" or
 * the actual reason it does not.
 *
 * Tightly throttled upstream (20/hour per IP): answering "is this code real?"
 * is exactly what a guessing attack needs. Validate when the shopper finishes
 * typing, not on every keystroke.
 */
import type { Http } from "../http.js";

export interface DiscountValidation {
  valid: true;
  /** Normalised (upper-cased) — use this when handing the code onward. */
  code: string;
  /** The merchant's name for the discount, e.g. "Summer sale". */
  title: string;
  /** What it takes off the `cartTotal` you supplied. "0.00" if you supplied none. */
  deduction: string;
  currency: string;
}

export function discountsResource(http: Http) {
  return {
    /**
     * POST /storefront/discounts/validate/ — is this a live code for this store?
     *
     * Pass `cartTotal` to have minimum-spend rules evaluated and get a real
     * deduction back; omit it and you learn only whether the code exists and is
     * live, with a zero deduction. Sending a total from the browser is safe
     * because nothing here is applied.
     *
     * Throws KurumeraError on a rejected code; `err.message` is already
     * shopper-facing ("This discount has expired.") and worth showing as-is —
     * knowing why is the difference between trying another code and giving up.
     */
    validate: (code: string, opts?: { cartTotal?: number | string; currency?: string }) =>
      http.post<DiscountValidation>("/storefront/discounts/validate/", {
        code,
        ...(opts?.cartTotal !== undefined ? { cart_total: String(opts.cartTotal) } : {}),
        ...(opts?.currency ? { currency: opts.currency } : {}),
      }),
  };
}

"use client";

/**
 * Client-side cart for a Kurumera storefront.
 *
 * Runs in the browser: resolves the store from the <slug>.kurumera.com host,
 * calls the public storefront cart API via @kurumera/storefront (X-Tenant-ID),
 * and keeps the cart token in localStorage under `plantsmall_cart` — the SAME
 * key the platform checkout reads, so "Checkout" hands the cart off cleanly to
 * the proven Stripe checkout without re-implementing payments in the theme.
 */
import { createKurumeraClient, trackEvent, EVENT, analyticsIdentity, sessionUtm } from "@kurumera/storefront";
import type { DiscountValidation } from "@kurumera/storefront";

// The SDK defaults to the public storefront API (admin.kurumera.com/api/v1).
const CART_KEY = "plantsmall_cart"; // shared with the platform checkout
const COUPON_KEY = "kurumera_coupon"; // the code the shopper applied, carried to checkout
const RESERVED = new Set(["www", "api", "admin", "app", "themekit", "cdn"]);

/** The store slug the browser is on (subdomain of kurumera.com, or an injected tenant). */
export function tenantSlug(): string {
  if (typeof window === "undefined") return "";
  const injected = (window as unknown as { __TENANT__?: { slug?: string } }).__TENANT__?.slug;
  if (injected) return injected;
  const host = window.location.hostname.toLowerCase();
  const m = host.match(/^([a-z0-9-]+)\.kurumera\.com$/);
  return m && !RESERVED.has(m[1]) ? m[1] : "";
}

function client() {
  return createKurumeraClient({ tenant: tenantSlug() });
}

export function getCartToken(): string | null {
  try { return localStorage.getItem(CART_KEY); } catch { return null; }
}
function setCartToken(token: string) {
  try { localStorage.setItem(CART_KEY, token); } catch { /* private mode */ }
}

/** Return the current cart token, creating a cart if there isn't a valid one. */
export async function ensureCart(): Promise<string> {
  const existing = getCartToken();
  if (existing) {
    try { await client().cart.get(existing); return existing; } catch { /* stale → new */ }
  }
  const cart = await client().cart.create();
  setCartToken(cart.token);
  window.dispatchEvent(new Event("kurumera:cart"));
  return cart.token;
}

export async function addToCart(variantId: string, quantity = 1) {
  const token = await ensureCart();
  const cart = await client().cart.addLine(token, { variant_id: variantId, quantity });
  window.dispatchEvent(new Event("kurumera:cart"));
  // After the API confirms it, not on click: a failed add is not an add, and
  // counting it would overstate the top of the funnel against the orders that
  // actually follow.
  trackEvent(EVENT.ADD_TO_CART, { data: { variant_id: variantId, quantity } });
  return cart;
}

export async function getCart() {
  const token = getCartToken();
  if (!token) return null;
  try { return await client().cart.get(token); } catch { return null; }
}

export async function setLineQuantity(lineId: string, quantity: number) {
  const token = getCartToken();
  if (!token) return null;
  const cart = await client().cart.updateLine(token, lineId, { quantity });
  window.dispatchEvent(new Event("kurumera:cart"));
  return cart;
}

export async function removeLine(lineId: string) {
  const token = getCartToken();
  if (!token) return null;
  const cart = await client().cart.removeLine(token, lineId);
  window.dispatchEvent(new Event("kurumera:cart"));
  trackEvent(EVENT.REMOVE_FROM_CART, { data: { line_id: lineId } });
  return cart;
}

/* ── Discount code ──────────────────────────────────────────────────────────
 *
 * A code used to be checkable only when the order was placed, so a shopper
 * typed one into the cart, got no response, and found out it had expired after
 * filling in an address and a card. These check it here.
 *
 * Nothing is applied locally. The saving shown is what the server calculated,
 * and the code is re-validated for real against the server's own cart when the
 * order is placed — this is an early answer, not a promise.
 */

/** Ask the platform whether a code is live, and what it would take off. */
export async function validateCoupon(code: string, cartTotal: number): Promise<DiscountValidation> {
  return client().discounts.validate(code, { cartTotal });
}

/** The code the shopper has applied, if any. */
export function getCoupon(): string | null {
  try { return localStorage.getItem(COUPON_KEY); } catch { return null; }
}

export function setCoupon(code: string | null) {
  try {
    if (code) localStorage.setItem(COUPON_KEY, code);
    else localStorage.removeItem(COUPON_KEY);
  } catch { /* private mode */ }
  window.dispatchEvent(new Event("kurumera:cart"));
}

// The platform's own proven checkout, fixed regardless of which host the
// storefront itself is on. It can't be derived from window.location.hostname
// (swapping the first label works for a <slug>.kurumera.com subdomain, but a
// merchant's own custom domain — e.g. allinonetool.store — has no relation to
// the platform's root at all; that regex previously produced "checkout.store",
// a domain Kurumera doesn't own).
const CHECKOUT_HOST = "checkout.kurumera.com";

/** Where "Checkout" sends the shopper: the platform's proven checkout, hosted on
 *  CHECKOUT_HOST so it serves its own assets (no /_next collision with the
 *  theme). Carries the store + cart token (cross-origin, so both go in the URL). */
export function checkoutHref(): string {
  const token = getCartToken();
  const slug = tenantSlug();
  if (typeof window === "undefined" || !slug) return "/cart";
  /*
   * Carry the analytics identity across the origin boundary.
   *
   * Checkout is hosted on checkout.kurumera.com, and localStorage is
   * per-origin — so the shopper who browsed and the shopper who paid are two
   * unrelated visitor_ids and the funnel cannot be joined. That is not a
   * missing event; it is every event landing under the wrong visitor once the
   * hand-off happens.
   *
   * Sending them costs nothing and is forward-compatible: the checkout app
   * ignores parameters it does not know. Joining them up needs a matching
   * change there to prefer an inbound id over a freshly minted one, which is
   * tracked separately — until then these are inert but correct.
   */
  const id = analyticsIdentity();
  const coupon = getCoupon();
  const qs = new URLSearchParams({
    store: slug,
    ...(token ? { cart_token: token } : {}),
    // The code the shopper already entered and had checked. Checkout has its
    // own promo input, so this saves them typing it a second time — and a code
    // retyped is a code mistyped. Applied server-side at order placement
    // either way; this only carries it across the origin boundary.
    ...(coupon ? { discount_code: coupon } : {}),
    kv: id.visitor_id,
    ks: id.session_id,
    // First-touch UTM too. Attribution is captured per ORIGIN, so without
    // forwarding it a purchase attributes to what the checkout origin saw —
    // nothing — instead of the campaign that drove the visit. The checkout app
    // already reads UTM from its own URL, so forwarding is the whole fix.
    ...sessionUtm(),
  });
  return `https://${CHECKOUT_HOST}/checkout?${qs.toString()}`;
}

/**
 * BEGIN_CHECKOUT, fired as the shopper leaves for the hosted checkout.
 *
 * The checkout app fires its own BEGIN_CHECKOUT when its page mounts, so this
 * is deliberately NOT a second copy of that event — it is the last thing that
 * happens on the merchant's own storefront, and the only place the theme can
 * observe intent to buy. Call it from the checkout button's onClick; the
 * tracker uses keepalive so the request survives the navigation it triggers.
 */
export function trackBeginCheckout(items: number, value: number, currency = ""): void {
  trackEvent(EVENT.BEGIN_CHECKOUT, { data: { items, value, currency, from: "storefront" } });
}

/** Cart line as returned by the storefront API (loose, matches the live store). */
export interface CartLine {
  id: string;
  variant_id?: string;
  product_title?: string;
  variant_title?: string;
  image_src?: string;
  quantity: number;
  unit_price?: string | number;
  line_total?: string | number;
}

export function lineTotal(l: CartLine): number {
  if (l.line_total != null) return Number(l.line_total) || 0;
  return (Number(l.unit_price) || 0) * (l.quantity || 0);
}
export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + lineTotal(l), 0);
}

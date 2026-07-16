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
import { createKurumeraClient } from "@kurumera/storefront";

// The SDK defaults to the public storefront API (admin.kurumera.com/api/v1).
const CART_KEY = "plantsmall_cart"; // shared with the platform checkout
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
  return cart;
}

/** Where "Checkout" sends the shopper: the platform's proven checkout, hosted on
 *  checkout.<root> so it serves its own assets (no /_next collision with the
 *  theme). Carries the store + cart token (cross-origin, so both go in the URL). */
export function checkoutHref(): string {
  const token = getCartToken();
  const slug = tenantSlug();
  if (typeof window === "undefined" || !slug) return "/cart";
  // <slug>.kurumera.com → checkout.kurumera.com
  const host = window.location.hostname.replace(/^[^.]+\./, "checkout.");
  const qs = new URLSearchParams({ store: slug, ...(token ? { cart_token: token } : {}) });
  return `https://${host}/checkout?${qs.toString()}`;
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

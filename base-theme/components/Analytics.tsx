"use client";

/**
 * Storefront analytics hooks for the theme.
 *
 * The tracker itself lives in `@kurumera/storefront` (identity, first-touch
 * UTM, dedupe, transport) so every theme reports identically and none of them
 * carry a copy that drifts. This file is only the React glue: where in a page's
 * lifecycle each event belongs.
 *
 * Nothing here takes an "is this real traffic" prop. The root layout sets
 * `window.__KURUMERA__.analytics` once, and the SDK honours it — so a preview
 * or editor render cannot pollute a merchant's funnel because one component
 * forgot to check a flag.
 *
 * Every component renders `null`. They are placed in a page for their effect,
 * not their output.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  trackEvent, EVENT,
  startSessionTracking, trackSearchClick, trackOutOfStockView,
} from "@kurumera/storefront";

/**
 * PAGE_VIEW on first paint and on every client-side navigation.
 *
 * Mounted once, in the root layout. The layout itself does not re-render when
 * the App Router swaps `children`, so this keys off `usePathname()` rather than
 * a mount effect — otherwise only the landing page would ever be counted.
 */
export function PageViews() {
  const pathname = usePathname();
  useEffect(() => {
    trackEvent(EVENT.PAGE_VIEW, { data: { path: pathname } });
  }, [pathname]);
  return null;
}

/**
 * PRODUCT_VIEW, deduped per product.
 *
 * Deduped because a product page re-renders on variant selection, quantity
 * changes and cart updates — without a key, choosing a size would count as
 * another view and inflate every product's demand signal.
 */
export function TrackProductView({ productId, handle }: { productId: string; handle?: string }) {
  useEffect(() => {
    if (!productId) return;
    trackEvent(EVENT.PRODUCT_VIEW, {
      data: { product_id: productId, ...(handle ? { handle } : {}) },
      dedupeKey: productId,
    });
  }, [productId, handle]);
  return null;
}

/** COLLECTION_VIEW, deduped per collection, for the same reason. */
export function TrackCollectionView({ collectionId, handle }: { collectionId: string; handle?: string }) {
  useEffect(() => {
    if (!collectionId) return;
    trackEvent(EVENT.COLLECTION_VIEW, {
      data: { collection_id: collectionId, ...(handle ? { handle } : {}) },
      dedupeKey: collectionId,
    });
  }, [collectionId, handle]);
  return null;
}

/**
 * SEARCH, and SEARCH_NO_RESULTS when the query returned nothing.
 *
 * The empty case is the valuable one: it is a shopper telling the merchant what
 * they stock a demand for and cannot sell. Keyed on the query so paging through
 * results does not re-count the search.
 */
export function TrackSearch({ query, results }: { query: string; results: number }) {
  useEffect(() => {
    const q = (query || "").trim();
    if (!q) return;
    trackEvent(EVENT.SEARCH, { data: { search_query: q, results }, dedupeKey: q });
    if (results === 0) {
      trackEvent(EVENT.SEARCH_NO_RESULTS, { data: { search_query: q }, dedupeKey: q });
    }
  }, [query, results]);
  return null;
}

/** CART_VIEW — the cart page was opened. Deduped per page load. */
export function TrackCartView({ items, value }: { items: number; value: number }) {
  useEffect(() => {
    trackEvent(EVENT.CART_VIEW, { data: { items, value } });
  }, [items, value]);
  return null;
}

/**
 * SESSION_START on the first page of a visit, SESSION_END when the tab goes.
 *
 * Mounted once, beside <PageViews /> in the root layout. Without these a visit
 * has no duration and no bounce — the backend can see the events inside a
 * session but not the session itself. The unload semantics (pagehide plus
 * visibilitychange, because mobile browsers freeze a backgrounded tab and never
 * fire beforeunload) live in the SDK so no theme gets them subtly wrong.
 */
export function SessionTracking() {
  useEffect(() => startSessionTracking(), []);
  return null;
}

/**
 * SEARCH_CLICK — which result the shopper actually chose.
 *
 * Not a mounted tracker: a click is an event, so this is a handler you attach
 * to the result link. SEARCH says somebody looked; this is the only thing that
 * says whether what they found was any use.
 *
 *   <Link href={href} onClick={() => searchClick(query, { productId: p.id, handle: p.handle, position: i + 1 })}>
 */
export function searchClick(
  query: string,
  result: { productId?: string; handle?: string; position?: number },
) {
  trackSearchClick(query, result);
}

/**
 * SEARCH_CLICK for a whole result list, by delegation.
 *
 * Renders nothing and listens on the document, so it can be dropped into any
 * search page without touching its markup. The alternatives were both worse:
 * an onClick prop cannot be passed to a Server Component card, and a wrapper
 * element changes the grid it wraps — a retrofit into somebody's own layout
 * must not move their CSS around.
 *
 * The handle comes from the href and the rank from the link's position among
 * the matched links, so a theme does not thread an index through its markup.
 * `within` narrows the scope when a page has product links that are not
 * results (a nav, a "related" rail).
 */
export function SearchResultClicks({ query, within }: { query: string; within?: string }) {
  useEffect(() => {
    if (!query || typeof document === "undefined") return;
    const SELECTOR = "a[href*='/products/']";
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.(SELECTOR);
      if (!link) return;
      const root = within ? document.querySelector(within) : document;
      if (!root || !root.contains(link)) return;
      const handle = (link.getAttribute("href") || "").match(/\/products\/([^/?#]+)/)?.[1];
      if (!handle) return;
      // Rank as the shopper sees it: 1-indexed among the result links.
      const links = [...root.querySelectorAll(SELECTOR)];
      trackSearchClick(query, { handle, position: links.indexOf(link) + 1 });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [query, within]);
  return null;
}

/**
 * OUT_OF_STOCK_VIEW — demand arriving at something that cannot be bought.
 *
 * Mount on a product page only when the product is actually unavailable. Keep
 * the condition at the call site rather than passing `inStock`, so a page that
 * never sells out never renders it at all.
 */
export function TrackOutOfStock({
  productId,
  handle,
  variantId,
}: { productId: string; handle?: string; variantId?: string }) {
  useEffect(() => {
    trackOutOfStockView(productId, { handle, variantId });
  }, [productId, handle, variantId]);
  return null;
}

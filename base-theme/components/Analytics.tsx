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
import { trackEvent, EVENT } from "@kurumera/storefront";

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

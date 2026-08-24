"use client";

import { useEffect } from "react";

/**
 * Records one view of a listing.
 *
 * Fires once per mount, after paint, and deliberately ignores its own response
 * — the number on screen came from the server render and does not need to jump
 * by one while the visitor is looking at it. Deduping is the server's job (one
 * view per client per 6h), so a reload does not inflate anything.
 */
export function CountView({ slug }: { slug: string }) {
  useEffect(() => {
    const id = window.setTimeout(() => {
      fetch(`/api/market/view?theme=${encodeURIComponent(slug)}`, { method: "POST", keepalive: true }).catch(() => {});
    }, 800);   // past a bounce; a visitor who leaves instantly did not view it
    return () => window.clearTimeout(id);
  }, [slug]);
  return null;
}

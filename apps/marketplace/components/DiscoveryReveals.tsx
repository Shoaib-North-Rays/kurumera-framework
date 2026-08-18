"use client";

import { useEffect } from "react";
import { observeReveals } from "@/lib/motion";

/**
 * Re-arms the SHARED reveal observer after a discovery navigation.
 *
 * Not a second observer — it calls the one in lib/motion.ts, which is
 * idempotent by design (it only picks up targets that are not yet revealed).
 *
 * Why it has to exist: MotionRoot observes once on mount. Every filter, chip,
 * sort and pager interaction here is a client-side navigation that swaps in a
 * fresh set of result cards, and those cards carry `data-reveal` — which, with
 * `html.js` armed, means opacity 0 until something observes them. Without this
 * they would stay invisible for the rest of the session. `token` is the filter
 * signature, so the effect re-runs on exactly the navigations that replace
 * results and on no others.
 *
 * Renders nothing, holds no state, and mounts no iframe — so it cannot re-key
 * or remount the preview subtree.
 */
export function DiscoveryReveals({ token }: { token: string }) {
  useEffect(() => {
    observeReveals();
    // Second pass on the next frame: the cards are streamed in with the RSC
    // payload and can land a tick after this effect runs.
    const id = requestAnimationFrame(() => observeReveals());
    return () => cancelAnimationFrame(id);
  }, [token]);
  return null;
}

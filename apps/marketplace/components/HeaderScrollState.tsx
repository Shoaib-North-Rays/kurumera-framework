"use client";

import { useEffect } from "react";

/** Below this the page is still visually "at the top" and the header should
 *  stay flat — flipping at 1px makes the bar flicker on trackpad rubber-band. */
const THRESHOLD = 8;

/**
 * Marks <html> with `data-scrolled` once the page has left the top, which is
 * what chrome.css keys the header's opaque/shadowed state on.
 *
 * Renders nothing. It exists as its own leaf so that adding this behaviour did
 * not require turning Header into a client component and dragging the brand,
 * the nav and the CTA into the JS bundle with it.
 *
 * Cheap by construction:
 *   · ONE passive listener, so it never blocks scrolling.
 *   · Reads `window.scrollY` only — a scroll-position read, not a geometry read
 *     like getBoundingClientRect/offsetHeight, so it forces no layout.
 *   · Writes only when the boolean actually flips. Steady-state cost during a
 *     long scroll is one comparison per event and zero DOM writes.
 */
export function HeaderScrollState() {
  useEffect(() => {
    const root = document.documentElement;
    let scrolled: boolean | null = null;

    const sync = () => {
      const next = window.scrollY > THRESHOLD;
      if (next === scrolled) return;
      scrolled = next;
      if (next) root.setAttribute("data-scrolled", "");
      else root.removeAttribute("data-scrolled");
    };

    sync(); // restored scroll position on a refresh must not start flat
    window.addEventListener("scroll", sync, { passive: true });
    return () => {
      window.removeEventListener("scroll", sync);
      root.removeAttribute("data-scrolled");
    };
  }, []);

  return null;
}

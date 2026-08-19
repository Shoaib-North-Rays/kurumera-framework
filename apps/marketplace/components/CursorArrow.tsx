"use client";

import { useEffect } from "react";

/**
 * Makes each card's arrow follow the pointer inside that card.
 *
 * ONE delegated listener on the wall, not one per card. Sixteen cards each
 * carrying their own pointermove handler is sixteen callbacks firing on a
 * single gesture; delegation keeps it to one, and the work per event is two
 * numbers written to CSS custom properties.
 *
 * The easing is CSS, not JS. Writing `--ax/--ay` on every pointermove and
 * letting a transition on `translate` chase them gives the trailing feel for
 * free, on the compositor, with no rAF loop and no interpolation in script.
 *
 * Never runs where it would be wrong: coarse pointers have no cursor to follow,
 * and prefers-reduced-motion gets a stationary arrow (the affordance survives,
 * the movement does not).
 */
export function CursorArrow({ selector }: { selector: string }) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(selector);
    if (!root) return;
    if (!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const onMove = (e: PointerEvent) => {
      const card = (e.target as Element | null)?.closest?.(".ew__card") as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--ax", `${e.clientX - r.left}px`);
      card.style.setProperty("--ay", `${e.clientY - r.top}px`);
    };

    // On leave, hand the arrow back to the card's centre so the next hover does
    // not start from wherever the pointer happened to exit.
    const onLeave = (e: PointerEvent) => {
      const card = (e.target as Element | null)?.closest?.(".ew__card") as HTMLElement | null;
      if (!card) return;
      card.style.removeProperty("--ax");
      card.style.removeProperty("--ay");
    };

    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerout", onLeave, { passive: true });
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerout", onLeave);
    };
  }, [selector]);

  return null;
}

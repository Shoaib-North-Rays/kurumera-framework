"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chevron } from "./Icons";

/**
 * Prev/next controls for an editorial rail.
 *
 * The rails were real scroll containers with the scrollbar hidden, drifting on
 * their own and reachable by wheel, trackpad, touch drag or keyboard — but on a
 * desktop with a mouse there was nothing to CLICK. A visitor who wanted to look
 * at the next template had to wait for the drift to bring it round, or discover
 * that a hidden-scrollbar strip can be dragged. So the catalogue was there and
 * felt like it wasn't.
 *
 * Clamped, not wrapping, because WallAutoScroll BOUNCES at each end rather than
 * looping (there are no cloned cards to land in). An arrow that wrapped would
 * disagree with the drift it sits on top of, so at the end the button disables
 * instead — which also tells you there is nothing more, rather than leaving you
 * clicking a dead control.
 *
 * Scrolling the rail fires its `scroll` event, which is exactly what
 * WallAutoScroll listens for to pause itself — so clicking an arrow stops the
 * drift fighting you, with no coupling between the two components.
 */
export function WallArrows({ selector, label, row }: { selector: string; label: string; row: 1 | 2 }) {
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const railRef = useRef<HTMLElement | null>(null);

  const sync = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const max = rail.scrollWidth - rail.clientWidth;
    // A pixel of slack: sub-pixel layout means scrollLeft rarely lands on an
    // exact 0 or max, and without it the arrows flicker between states.
    setCanPrev(rail.scrollLeft > 1);
    setCanNext(rail.scrollLeft < max - 1);
  }, []);

  useEffect(() => {
    const rail = document.querySelector<HTMLElement>(selector);
    railRef.current = rail;
    if (!rail) return;

    sync();
    rail.addEventListener("scroll", sync, { passive: true });
    /* The rail's scrollable extent changes when covers finish loading, when the
       viewport changes and when --ew-w changes at a breakpoint — none of which
       fire `scroll`. Without observing size, "canNext" could be stuck false on
       first paint and the next arrow would render dead. */
    const ro = new ResizeObserver(sync);
    ro.observe(rail);
    const row = rail.firstElementChild;
    if (row) ro.observe(row);

    return () => {
      rail.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [selector, sync]);

  const nudge = (dir: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    // One card, measured — not a hardcoded 792px. --ew-w changes at breakpoints
    // and a fixed step would under- or over-shoot on every screen but one.
    const card = rail.querySelector<HTMLElement>("article");
    const row = rail.firstElementChild as HTMLElement | null;
    const gap = row ? parseFloat(getComputedStyle(row).columnGap || "0") || 0 : 0;
    const step = card ? card.getBoundingClientRect().width + gap : rail.clientWidth * 0.8;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* Tell the drift to stand down BEFORE moving. WallAutoScroll assigns
       rail.scrollLeft every animation frame; without this it overwrites the
       smooth scroll on the next frame and the click travels a few pixels
       instead of a card. Hovering does not help either — these buttons sit
       over the rail but are not inside it, so its pointerenter never fires. */
    rail.dispatchEvent(new Event("wall:takeover"));
    rail.scrollBy({ left: dir * step, behavior: reduce ? "auto" : "smooth" });
  };

  // Nothing to scroll (a short catalogue on a wide screen) — render nothing
  // rather than two permanently dead buttons.
  if (!canPrev && !canNext) return null;

  return (
    <div className={`ew__nav ew__nav--${row}`} role="group" aria-label={`${label} controls`}>
      <button
        type="button"
        className="ew__navbtn"
        aria-label={`Previous ${label}`}
        disabled={!canPrev}
        onClick={() => nudge(-1)}
      >
        <Chevron />
      </button>
      <button
        type="button"
        className="ew__navbtn ew__navbtn--next"
        aria-label={`Next ${label}`}
        disabled={!canNext}
        onClick={() => nudge(1)}
      >
        <Chevron />
      </button>
    </div>
  );
}

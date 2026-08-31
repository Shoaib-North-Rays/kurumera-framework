"use client";

import { useEffect } from "react";

/**
 * Continuous drift for the editorial wall.
 *
 * WHY THE PREVIOUS ATTEMPT NEVER MOVED, since it is an easy trap to repeat:
 * it measured `scrollWidth <= clientWidth` once, inside the mount effect, and
 * returned permanently if the rail did not look scrollable yet. At hydration it
 * frequently does not — the cards use `aspect-ratio` and `fill` images, so the
 * row has not been laid out at its real width when the effect first runs. One
 * early measurement therefore disabled the whole thing for the life of the page,
 * silently and un-debuggably.
 *
 * So this version NEVER early-returns on measurement. The loop runs and asks
 * about scrollability every frame; a rail that becomes scrollable later simply
 * starts moving.
 *
 * It also drives `scrollLeft` rather than a transform, which keeps the rail a
 * real scroll container — native wheel, trackpad, touch drag and keyboard all
 * continue to work, and the user can take over at any moment.
 */

/** ~18px/s at 60fps. Slow enough to read a card as it passes. */
const PX_PER_FRAME = 0.3;
/** How long to wait after the user stops before drifting again. */
const RESUME_AFTER_MS = 2600;

export function WallAutoScroll({
  selector,
  direction = "right",
}: {
  selector: string;
  /** STARTING direction: "right" heads toward the end, "left" starts parked at
   *  the end and heads back. Each row then reverses at whichever end it
   *  reaches. Two rows moving opposite ways is what makes the wall read as a
   *  moving surface rather than one long belt. */
  direction?: "left" | "right";
}) {
  useEffect(() => {
    const rail = document.querySelector<HTMLElement>(selector);
    if (!rail) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let paused = false;
    /**
     * FRACTIONAL POSITION, kept here rather than read back from the element.
     *
     * This is what broke the previous two attempts. `scrollLeft` reads back as
     * an INTEGER, so `rail.scrollLeft += 0.3` writes 0.3, reads 0, and the
     * fraction is discarded — every frame, forever. The rail sat at exactly 0
     * while the loop ran perfectly, which is a maddening thing to debug: the
     * effect mounts, rAF fires, the element is scrollable, and nothing moves.
     * Accumulating in a float and assigning the total each frame fixes it.
     */
    // A left-drifting row must START at the end, or it has nowhere to travel.
    if (direction === "left") rail.scrollLeft = rail.scrollWidth - rail.clientWidth;
    let pos = rail.scrollLeft;
    /** +1 travels toward the end, -1 back toward the start. Flipped at each
     *  end by the step below, so the drift never has to teleport. */
    let dir = direction === "right" ? 1 : -1;
    let resumeTimer: number | undefined;
    let disposed = false;

    const pause = () => {
      paused = true;
      // Re-sync: the user has moved it, so the accumulator must follow or the
      // next frame would yank the rail back to where the drift had reached.
      pos = rail.scrollLeft;
      window.clearTimeout(resumeTimer);
      // Resume only after the user has genuinely stopped, so it never fights
      // an in-progress gesture.
      resumeTimer = window.setTimeout(() => { paused = false; }, RESUME_AFTER_MS);
    };

    const step = () => {
      if (disposed) return;
      // Measured EVERY frame, never once at mount — see the note above.
      const max = rail.scrollWidth - rail.clientWidth;
      if (!paused && !document.hidden && max > 1) {
        // BOUNCE, not wrap. Jumping from one end to the other only looks
        // continuous if there is a duplicate set of cards to land in; there
        // isn't, so the old `pos >= max ? 0` reset moved the rail 735px
        // backwards in a single frame (measured). Cloning the row would fix
        // the seam but hands screen-reader and keyboard users every template
        // twice. Reversing at each end needs no clones and has no seam — and
        // the rows still read as opposed, because each turns around at its own
        // end rather than all snapping back together.
        const next = pos + dir * PX_PER_FRAME;
        if (next >= max) { pos = max; dir = -1; }
        else if (next <= 0) { pos = 0; dir = 1; }
        else { pos = next; }
        rail.scrollLeft = pos;
      }
      raf = requestAnimationFrame(step);
    };

    // Pause on any sign of intent; resume once they are done.
    const onEnter = () => { paused = true; window.clearTimeout(resumeTimer); };
    const onLeave = () => { pos = rail.scrollLeft; paused = false; };
    rail.addEventListener("pointerenter", onEnter);
    rail.addEventListener("pointerleave", onLeave);
    rail.addEventListener("focusin", onEnter);
    rail.addEventListener("focusout", onLeave);
    /* An explicit takeover signal, because `scroll` cannot be used: this
       component WRITES rail.scrollLeft every frame, so listening for scroll
       would pause it against its own movement and it would never drift again.
       The rail arrows dispatch this before they scrollBy — without it the rAF
       loop below overwrites scrollLeft on the very next frame and cancels the
       smooth animation, which made an arrow click travel ~27px instead of a
       whole card. */
    rail.addEventListener("wall:takeover", pause);
    rail.addEventListener("wheel", pause, { passive: true });
    rail.addEventListener("touchstart", pause, { passive: true });
    rail.addEventListener("keydown", pause);

    raf = requestAnimationFrame(step);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(resumeTimer);
      rail.removeEventListener("pointerenter", onEnter);
      rail.removeEventListener("pointerleave", onLeave);
      rail.removeEventListener("focusin", onEnter);
      rail.removeEventListener("focusout", onLeave);
      rail.removeEventListener("wall:takeover", pause);
      rail.removeEventListener("wheel", pause);
      rail.removeEventListener("touchstart", pause);
      rail.removeEventListener("keydown", pause);
    };
  }, [selector, direction]);

  return null;
}

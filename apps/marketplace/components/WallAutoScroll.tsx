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
  /** "right" drifts toward the end; "left" drifts back toward the start. Two
   *  rows moving opposite ways is what makes the wall read as a moving surface
   *  rather than one long belt. */
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
        if (direction === "right") {
          pos = pos >= max - 1 ? 0 : pos + PX_PER_FRAME;   // wrap at the end
        } else {
          pos = pos <= 1 ? max : pos - PX_PER_FRAME;       // wrap at the start
        }
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
      rail.removeEventListener("wheel", pause);
      rail.removeEventListener("touchstart", pause);
      rail.removeEventListener("keydown", pause);
    };
  }, [selector, direction]);

  return null;
}

"use client";

import { useEffect } from "react";

/**
 * Gentle auto-advance for the mosaic rail.
 *
 * WHY IT EARNS ITS PLACE (the rule: hierarchy, orientation, discovery or
 * feedback): DISCOVERY. A horizontal rail's failure mode is that people never
 * realise it scrolls, so seven of eight templates are never seen. Motion states
 * "there is more here" better than any arrow button.
 *
 * WHAT IT MUST NEVER DO is fight the person using it. It therefore stops — not
 * pauses, STOPS for good — the moment there is any sign of intent: a pointer
 * over the rail, keyboard focus inside it, or a manual scroll/touch/wheel. An
 * autoplaying thing that resumes while someone is reading is worse than one
 * that never moved.
 *
 * It also yields entirely to prefers-reduced-motion (no drift at all), to a
 * hidden tab, and to a rail with nothing to scroll.
 *
 * Implemented as pixels-per-frame rather than a CSS animation because the rail
 * is a real scroll container: driving scrollLeft keeps the native scrollbar,
 * snap points, keyboard scrolling and touch drag all working, which a
 * transform-based marquee would silently break.
 */

/** Slow enough to read a tile as it passes; ~24px/s at 60fps. */
const PX_PER_FRAME = 0.4;

export function RailAutoScroll({ selector }: { selector: string }) {
  useEffect(() => {
    const rail = document.querySelector<HTMLElement>(selector);
    if (!rail) return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // Nothing to advance through.
    if (rail.scrollWidth <= rail.clientWidth + 1) return;

    let frame = 0;
    let stopped = false;

    const stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      rail.removeEventListener("pointerenter", stop);
      rail.removeEventListener("focusin", stop);
      rail.removeEventListener("wheel", stop);
      rail.removeEventListener("touchstart", stop);
      rail.removeEventListener("keydown", stop);
    };

    const step = () => {
      if (stopped) return;
      if (!document.hidden) {
        const max = rail.scrollWidth - rail.clientWidth;
        // Stop at the end rather than looping. A loop would either jump
        // (visibly broken) or need cloned tiles, which duplicates every link
        // for screen readers and keyboard users.
        if (rail.scrollLeft >= max - 1) {
          stop();
          return;
        }
        rail.scrollLeft += PX_PER_FRAME;
      }
      frame = requestAnimationFrame(step);
    };

    // `passive` on wheel/touch: these listeners only cancel the animation, so
    // they must never delay the user's own scroll.
    rail.addEventListener("pointerenter", stop);
    rail.addEventListener("focusin", stop);
    rail.addEventListener("wheel", stop, { passive: true });
    rail.addEventListener("touchstart", stop, { passive: true });
    rail.addEventListener("keydown", stop);

    // Only start once the rail is actually on screen — drifting a rail nobody
    // has reached wastes the reveal and lands them mid-row.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !stopped) {
            io.disconnect();
            frame = requestAnimationFrame(step);
          }
        }
      },
      { threshold: 0.35 },
    );
    io.observe(rail);

    return () => {
      io.disconnect();
      stop();
    };
  }, [selector]);

  return null;
}

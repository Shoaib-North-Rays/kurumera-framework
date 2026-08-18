/**
 * The single scroll-reveal engine for the marketplace.
 *
 * ONE IntersectionObserver for the whole document, not one per element. A page
 * of cards and editorial blocks can easily carry 60+ reveal targets; an observer
 * each means 60 sets of callbacks competing on the same scroll, which is exactly
 * how "premium motion" turns into jank on a mid-range phone.
 *
 * Elements opt in declaratively with `data-reveal` (see motion.css for the
 * variants). This module only decides WHEN something has entered; the transition
 * itself is CSS, so it runs on the compositor and costs no main-thread work.
 *
 * Reveal is one-way. Re-hiding content that scrolls back out is a well-known
 * irritation when you scroll up to re-read something, so a revealed element is
 * unobserved and left alone.
 */

/** Applied to <html> by the inline boot script; the CSS hidden state keys on it. */
export const JS_CLASS = "js";

const REVEALED = "is-revealed";
const SELECTOR = "[data-reveal]:not(." + REVEALED + ")";

/** Fire when ~12% of the element is up. Enough that it reads as "arriving with
 *  the scroll" rather than popping after the fact. */
const THRESHOLD = 0.12;
/** Start slightly before the true viewport edge, and never trigger from the
 *  bottom margin (which would reveal things the user has scrolled PAST). */
const ROOT_MARGIN = "0px 0px -8% 0px";

let observer: IntersectionObserver | null = null;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Stagger siblings inside a `[data-reveal-group]`.
 *
 * Done as a per-element `--reveal-delay` rather than nth-child CSS so a group
 * can hold any number of children, and so the delay is computed once at reveal
 * time instead of being baked into a stylesheet that cannot know the count.
 *
 * Capped: past ~6 steps the last item arrives so late it reads as broken rather
 * than choreographed.
 */
const MAX_STAGGER_STEPS = 6;

function applyStagger(el: HTMLElement): void {
  const group = el.closest<HTMLElement>("[data-reveal-group]");
  if (!group) return;
  const siblings = Array.from(group.querySelectorAll<HTMLElement>("[data-reveal]"));
  const index = siblings.indexOf(el);
  if (index <= 0) return;
  const step = Math.min(index, MAX_STAGGER_STEPS);
  el.style.setProperty("--reveal-delay", `calc(var(--stagger) * ${step})`);
}

function reveal(el: HTMLElement): void {
  applyStagger(el);
  el.classList.add(REVEALED);
}

function ensureObserver(): IntersectionObserver | null {
  if (observer) return observer;
  if (typeof IntersectionObserver === "undefined") return null;
  observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        reveal(el);
        obs.unobserve(el); // one-way: never re-hide
      }
    },
    { threshold: THRESHOLD, rootMargin: ROOT_MARGIN },
  );
  return observer;
}

/**
 * Observe every not-yet-revealed target. Safe to call repeatedly — after a
 * route change, or when a section loads more items.
 *
 * Every early return REVEALS rather than hides, because the hidden state is
 * CSS-gated on `html.js`: once that class is set, anything this function fails
 * to handle would stay invisible. Reduced motion and a missing
 * IntersectionObserver therefore both mean "show it now".
 */
export function observeReveals(root: ParentNode = document): void {
  if (typeof document === "undefined") return;

  const targets = Array.from(root.querySelectorAll<HTMLElement>(SELECTOR));
  if (targets.length === 0) return;

  if (prefersReducedMotion()) {
    targets.forEach((el) => el.classList.add(REVEALED));
    return;
  }

  const io = ensureObserver();
  if (!io) {
    targets.forEach((el) => el.classList.add(REVEALED));
    return;
  }

  for (const el of targets) {
    // Already on screen at mount (above the fold): reveal immediately rather
    // than waiting for a scroll that may never come.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      reveal(el);
      continue;
    }
    io.observe(el);
  }
}

/** Release everything — for teardown in tests or a full client re-render. */
export function disconnectReveals(): void {
  observer?.disconnect();
  observer = null;
}

/**
 * The inline boot script. Runs before paint and sets `html.js`, which is what
 * ARMS the hidden state — so the un-styled window where content would be
 * invisible never exists. Kept as a string because it must ship inline, ahead
 * of hydration; a component that set this in an effect would flash.
 */
export const BOOT_SCRIPT = `document.documentElement.classList.add("${JS_CLASS}")`;

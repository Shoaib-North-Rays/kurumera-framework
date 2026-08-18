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

  // The engine is alive — stand the disarm timer down. Done FIRST, before any
  // early return, because "there was nothing to observe" is still a healthy
  // engine and must not be punished by stripping `html.js` three seconds later.
  cancelFailsafe();

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

/** Where the disarm timer parks its id, so `observeReveals` can cancel it. */
const FAILSAFE_KEY = "__kurumeraRevealFailsafe";

/**
 * If the reveal engine never reports for duty, DISARM the whole system.
 *
 * `html.js` is set by an inline script, so it is armed the moment JS exists —
 * but the thing that actually reveals anything is React. Between those two
 * facts sits a real failure mode: JS runs, the class lands, and then hydration
 * never completes (a chunk 404s, a third-party script throws, the bundle is
 * still in flight on a bad connection). The page would sit there permanently
 * blank with all its content in the DOM.
 *
 * So the arming is now provisional. Nothing clears this timer except a
 * successful `observeReveals()`; if that has not happened within the window,
 * `html.js` comes off and every hidden state in motion.css stops applying.
 * The page loses its animation and keeps its content, which is the correct
 * direction to fail in.
 */
const FAILSAFE_MS = 3000;

function cancelFailsafe(): void {
  const w = window as unknown as Record<string, number | undefined>;
  const id = w[FAILSAFE_KEY];
  if (id !== undefined) {
    clearTimeout(id);
    w[FAILSAFE_KEY] = undefined;
  }
}

/**
 * The second inline script, mounted at the END of <body>.
 *
 * TWO JOBS, both of which have to happen before React exists.
 *
 * 1. REVEAL WHAT IS ALREADY ON SCREEN. `observeReveals` does this too, but only
 *    once MotionRoot's effect runs — i.e. after hydration. That made the
 *    largest contentful paint of every page depend on a JS bundle downloading,
 *    parsing and hydrating: the hero headline is server-rendered into the HTML,
 *    the browser has it, and it was being held at opacity 0 / clipped until
 *    React said so. Running the first pass inline at parse time hands the
 *    above-the-fold content back to first paint, and the entrance transition
 *    still plays because the element goes from its hidden style to `.is-revealed`
 *    exactly as it would have.
 *
 * 2. ARM THE DISARM TIMER (above).
 *
 * Written as a string, and deliberately duplicating the stagger arithmetic from
 * `applyStagger`, because it must ship inline ahead of any module. Kept in this
 * file so the two copies of that rule sit next to each other and cannot drift
 * unnoticed. Wrapped in try/catch whose handler REVEALS EVERYTHING — every exit
 * from this script leaves content visible, never hidden.
 */
export const EAGER_SCRIPT = `(function(){var d=document,S="${REVEALED}",Q="[data-reveal]:not(."+S+")";
function all(){var n=d.querySelectorAll(Q);for(var i=0;i<n.length;i++)n[i].classList.add(S)}
try{
if(!matchMedia("(prefers-reduced-motion: no-preference)").matches){all()}
else{var st=(getComputedStyle(d.documentElement).getPropertyValue("--stagger")||"90ms").trim(),h=innerHeight,n=d.querySelectorAll(Q);
for(var i=0;i<n.length;i++){var e=n[i],b=e.getBoundingClientRect();
if(b.top>=h||b.bottom<=0)continue;
var g=e.closest("[data-reveal-group]");
if(g){var k=Array.prototype.indexOf.call(g.querySelectorAll("[data-reveal]"),e);
if(k>0)e.style.setProperty("--reveal-delay","calc("+st+" * "+Math.min(k,${MAX_STAGGER_STEPS})+")")}
e.classList.add(S)}}}catch(x){all()}
window.${FAILSAFE_KEY}=setTimeout(function(){d.documentElement.classList.remove("${JS_CLASS}")},${FAILSAFE_MS})})()`;

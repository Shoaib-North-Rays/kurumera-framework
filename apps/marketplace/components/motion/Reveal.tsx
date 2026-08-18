"use client";

/**
 * The React surface of the motion system.
 *
 * Two pieces only, so sections never hand-roll their own animation:
 *   <MotionRoot/>  — mounted once in the layout; starts the shared observer.
 *   <Reveal>       — wraps anything that should arrive on scroll.
 *
 * Both render plain markup with a `data-reveal` attribute. The motion lives in
 * motion.css and the timing in lib/motion.ts, which means a section that opts
 * out of JS still renders its content, and a designer can retune every reveal
 * on the site from the tokens without touching a component.
 */

import { useEffect, type ElementType, type ReactNode } from "react";
import { observeReveals } from "@/lib/motion";

export type RevealVariant = "up" | "mask" | "scale" | "fade";

/**
 * Mount ONCE, in the root layout. Re-runs on pathname change so a client
 * navigation picks up the new page's targets.
 */
export function MotionRoot({ pathKey }: { pathKey?: string }) {
  useEffect(() => {
    observeReveals();
    // A second pass on the next frame catches anything that mounted during
    // hydration — Suspense boundaries and client lists commonly land a tick
    // after the first effect runs, and a missed target would stay hidden.
    const id = requestAnimationFrame(() => observeReveals());
    return () => cancelAnimationFrame(id);
  }, [pathKey]);
  return null;
}

/**
 * Reveal-on-scroll wrapper.
 *
 * `as` keeps the markup semantic — a revealed heading should still be an <h2>,
 * not a <div> wrapping one, or the outline and screen-reader experience suffer
 * for the sake of an animation.
 */
export function Reveal({
  children,
  as: Tag = "div",
  variant = "up",
  className,
  style,
  ...rest
}: {
  children: ReactNode;
  as?: ElementType;
  variant?: RevealVariant;
  className?: string;
  style?: React.CSSProperties;
} & Record<string, unknown>) {
  return (
    <Tag
      // "up" is the CSS default, so it is written as a bare marker rather than
      // a value — keeps the DOM readable when most reveals are the default.
      data-reveal={variant === "up" ? "" : variant}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * Marks a group whose `<Reveal>` children should arrive in sequence rather than
 * together. The delay is computed per element at reveal time (lib/motion.ts) so
 * the group can hold any number of children.
 */
export function RevealGroup({
  children,
  as: Tag = "div",
  className,
  style,
  ...rest
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  style?: React.CSSProperties;
} & Record<string, unknown>) {
  return (
    <Tag data-reveal-group="" className={className} style={style} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * Splits a headline into lines that rise independently — the one effect worth
 * having as a component, because the brief calls for headlines that break
 * deliberately ("DISCOVER / WHAT'S / NEXT.").
 *
 * Lines are passed as an ARRAY, never guessed from a string. Measuring where
 * text wraps and injecting spans is fragile across fonts and breakpoints, and
 * it breaks selection and screen-reader output; the author knows the intended
 * break and states it.
 *
 * The <span> per line carries the clip, and each line is a reveal target inside
 * an implicit group, so they stagger without extra markup.
 */
export function RevealLines({
  lines,
  as: Tag = "h1",
  className,
  lineClassName,
  ...rest
}: {
  lines: string[];
  as?: ElementType;
  className?: string;
  lineClassName?: string;
} & Record<string, unknown>) {
  return (
    <Tag className={className} data-reveal-group="" {...rest}>
      {lines.map((line, i) => (
        // overflow:hidden gives the mask something to clip against; the inner
        // span is what actually moves.
        <span
          key={i}
          className={lineClassName}
          style={{ display: "block", overflow: "hidden" }}
        >
          <span data-reveal="mask" style={{ display: "block" }}>
            {line}
          </span>
        </span>
      ))}
    </Tag>
  );
}

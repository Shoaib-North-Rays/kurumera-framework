"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Focusables inside the drawer, in DOM order, for the Tab trap. */
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Hamburger + slide-in drawer, so mobile users keep full navigation (the
 * desktop nav is display:none under 960px).
 *
 * It is a modal dialog, so it now behaves like one: focus moves into it on
 * open, Tab cannot walk out of it into the page behind, and focus returns to
 * the hamburger on close. Previously Tab escaped into the page underneath
 * immediately — a screen-reader or keyboard user was reading a page they could
 * not see, with no obvious way back.
 */
export function MobileNav({ items }: { items: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();

  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    toggleRef.current?.focus();
  }, []);

  /* A tapped link navigates; the drawer must not stay open over the new page.
     Keyed on pathname rather than on the click so it also closes when the
     navigation comes from anywhere else (back button, in-drawer CTA). */
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && panel.contains(active);
      if (e.shiftKey && (!inside || active === first)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (!inside || active === last)) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={toggleRef}
        className="nav-toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span /><span /><span />
      </button>
      {open && (
        <div className="mobile-nav" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="mobile-nav__backdrop" onClick={close} />
          <nav id={panelId} ref={panelRef} className="mobile-nav__panel" aria-label="Mobile">
            {items.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                /* Orientation: the drawer is the only navigation a phone user
                   has, so it is the only place that can say where they are. */
                aria-current={pathname === n.href ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {n.label}
              </Link>
            ))}
            {/* Was "Start Building", which linked to /templates — the catalogue, not
                the builder. Same false label the header CTA carried; removed
                there, so it goes here too. The destination was always right,
                only the words were wrong. */}
            <Link href="/templates" className="btn btn--primary btn--block" onClick={() => setOpen(false)}>Browse all templates</Link>
          </nav>
        </div>
      )}
    </>
  );
}

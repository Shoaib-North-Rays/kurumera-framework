"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/** Hamburger + slide-in drawer so mobile users keep full navigation (the desktop
 *  nav is display:none under 960px). */
export function MobileNav({ items }: { items: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      <button
        className="nav-toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span /><span /><span />
      </button>
      {open && (
        <div className="mobile-nav" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="mobile-nav__backdrop" onClick={() => setOpen(false)} />
          <nav className="mobile-nav__panel" aria-label="Mobile">
            {items.map((n) => (
              <Link key={n.label} href={n.href} onClick={() => setOpen(false)}>{n.label}</Link>
            ))}
            <Link href="/templates" className="btn btn--primary btn--block" onClick={() => setOpen(false)}>Start Building</Link>
          </nav>
        </div>
      )}
    </>
  );
}

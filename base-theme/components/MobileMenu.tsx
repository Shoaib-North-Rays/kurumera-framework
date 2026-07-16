"use client";

import { useState } from "react";
import Link from "next/link";
import { MenuIcon, CloseIcon } from "@/components/Icon";

/** Hamburger + slide-in nav drawer (shown only on small screens via CSS). */
export function MobileMenu({ items }: { items: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mobilemenu">
      <button className="icon-btn mobilemenu__toggle" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <MenuIcon />
      </button>
      {open && (
        <div className="mobilemenu__overlay" onClick={() => setOpen(false)}>
          <nav className="mobilemenu__panel" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn mobilemenu__close" aria-label="Close" onClick={() => setOpen(false)}>
              <CloseIcon />
            </button>
            <Link href="/" onClick={() => setOpen(false)}>Home</Link>
            {items.map((it, i) => (
              <Link key={i} href={it.href} onClick={() => setOpen(false)}>{it.label}</Link>
            ))}
            <Link href="/search" onClick={() => setOpen(false)}>Search</Link>
          </nav>
        </div>
      )}
    </div>
  );
}

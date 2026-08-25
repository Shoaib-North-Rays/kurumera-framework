"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The chrome shared by every guide and legal page.
 *
 * One nav definition. The footer previously listed four links while fifteen
 * routes existed, because the list was hand-maintained in the one place it was
 * rendered; adding eight pages the same way guarantees the same drift. `SECTIONS`
 * below is the single source, and `docPageMeta()` derives the prev/next pairs
 * from it too — so a page added here is linked, ordered and reachable without
 * touching anything else.
 */

export type DocLink = { label: string; href: string };
export type DocSection = { title: string; links: DocLink[] };

export const SECTIONS: DocSection[] = [
  {
    title: "Sell on Kurumera",
    links: [
      { label: "Why sell here", href: "/sell" },
      { label: "Build & publish a template", href: "/docs/creator-guide" },
      { label: "Getting paid", href: "/docs/payouts" },
      { label: "Tax responsibilities", href: "/docs/taxes" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Template licence", href: "/license" },
      { label: "Refund policy", href: "/refunds" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
];

/** Flat, in nav order — the sequence prev/next walks. */
const FLAT = SECTIONS.flatMap((s) => s.links);

export function docNeighbours(href: string) {
  const i = FLAT.findIndex((l) => l.href === href);
  return { prev: i > 0 ? FLAT[i - 1] : null, next: i >= 0 && i < FLAT.length - 1 ? FLAT[i + 1] : null };
}

/* ── Section nav ──────────────────────────────────────────────────────── */
function DocNav() {
  const path = usePathname();
  return (
    <aside className="doc__side">
      <nav aria-label="Documentation sections">
        {SECTIONS.map((s) => (
          <div key={s.title} className="doc__sidegroup">
            <h2 className="doc__sidetitle">{s.title}</h2>
            <div className="doc__sidelist">
              {s.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="doc__sidelink"
                  /* aria-current is what tells a screen-reader user where they
                     are; the green rule is only the sighted half of that. */
                  aria-current={path === l.href ? "page" : undefined}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

/* ── On this page ─────────────────────────────────────────────────────── */
export type TocItem = { id: string; label: string };

function DocToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const nodes = items.map((i) => document.getElementById(i.id)).filter((n): n is HTMLElement => !!n);
    if (!nodes.length) return;

    /**
     * Scrollspy.
     *
     * rootMargin pulls the detection band up to just under the sticky header
     * and down to the top third of the viewport. Without the negative bottom
     * margin every heading below the fold counts as "intersecting" on a long
     * page and the last one always wins, which is the classic broken TOC.
     */
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-88px 0px -66% 0px", threshold: 0 },
    );

    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  }, [items]);

  if (items.length < 2) return null;   // a one-item contents list is furniture

  return (
    <aside className="doc__toc">
      <nav aria-label="On this page">
        <h2 className="doc__sidetitle">On this page</h2>
        <div className="doc__toclist">
          {items.map((i) => (
            <a
              key={i.id}
              href={`#${i.id}`}
              className="doc__toclink"
              data-active={active === i.id ? "true" : undefined}
            >
              {i.label}
            </a>
          ))}
        </div>
      </nav>
    </aside>
  );
}

/* ── Prev / next ──────────────────────────────────────────────────────── */
export function DocPager({ href }: { href: string }) {
  const { prev, next } = docNeighbours(href);
  if (!prev && !next) return null;
  return (
    <nav className="docnav" aria-label="Related pages">
      {prev ? (
        <Link className="docnav__card docnav__card--prev" href={prev.href}>
          <span className="docnav__dir">Previous</span>
          <span className="docnav__t">{prev.label}</span>
        </Link>
      ) : <span />}
      {next ? (
        <Link className="docnav__card docnav__card--next" href={next.href}>
          <span className="docnav__dir">Next</span>
          <span className="docnav__t">{next.label}</span>
        </Link>
      ) : null}
    </nav>
  );
}

/* ── Shell ────────────────────────────────────────────────────────────── */
export function DocShell({ toc, children }: { toc: TocItem[]; children: React.ReactNode }) {
  return (
    <div className="wrap doc">
      <DocNav />
      <div className="doc__main">{children}</div>
      <DocToc items={toc} />
    </div>
  );
}

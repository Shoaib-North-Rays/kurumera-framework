import Image from "next/image";
import Link from "next/link";
import type { Template } from "@/lib/registry";
import { SearchForm } from "./SearchForm";

/**
 * Home hero — two columns: the pitch on the left, a stack of live template
 * covers on the right, with a "at a glance" panel over them.
 *
 * The device stack uses REAL covers, not invented product shots. The mockup this
 * was built from showed three fictional themes; the whole argument of the page
 * is "preview before you choose", so showing templates that do not exist would
 * undercut it on the first screen.
 *
 * WHAT IS DELIBERATELY ABSENT: the mockup carried "Trusted by 2,000+ creators"
 * and "4.9/5 from 1,200+ reviews" over a row of avatars. There are eight
 * creators, three installs in total, and no reviews system at all — the product
 * explicitly has none (DetailTabs: "no reviews… no data yet"). Printing those
 * numbers would be inventing social proof, which is a different thing from
 * designing a hero. The counts panel does the same job with figures that are
 * true, and they are genuinely good ones: every template free to preview, half
 * of them free to keep.
 */

/** Inline 20px stroke icons — no library, no network, no layout shift. */
const I = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  cart: "M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6M9 21h.01M18 21h.01",
  doc: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4",
  case: "M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  users: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 20v-2a4 4 0 0 0-3-3.9M17 4.1a4 4 0 0 1 0 7.8",
  tag: "M20 12l-8.6 8.6a2 2 0 0 1-2.8 0l-6.2-6.2a2 2 0 0 1 0-2.8L11 3h9v9zM16 8h.01",
  spark: "M12 3l2 5.5L19.5 10 14 12l-2 5.5L10 12 4.5 10 10 8.5z",
};

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Category key -> icon, so a chip reads at a glance. Unknown keys get the tag. */
const CHIP_ICON: Record<string, string> = {
  ecommerce: I.cart, blog: I.doc, business: I.case, agency: I.users,
  portfolio: I.grid, restaurant: I.tag,
};

type Stat = { label: string; value: string; href: string; icon: string; tone: string };

export function Hero({
  templates,
  freeCount,
  paidCount,
  creatorCount,
  filledCategories,
  totalCategories,
  lowestPaid,
  chips,
  heroArt,
}: {
  templates: Template[];
  freeCount: number;
  paidCount: number;
  creatorCount: number;
  filledCategories: number;
  totalCategories: number;
  lowestPaid: number | null;
  /** Categories that actually contain templates — a chip must lead somewhere. */
  chips: { key: string; label: string }[];
  /** Optional dedicated hero artwork, in slot order. */
  heroArt?: string[];
}) {
  const total = templates.length;

  /**
   * The three hero shots.
   *
   * Prefers dedicated artwork at /public/hero-1..3.png when present — the
   * mockup uses three purpose-made UI shots (a tall dark theme, a wide light
   * storefront, a phone), which read better at this scale than three cropped
   * cover screenshots. Falls back to real covers so the hero is never empty and
   * never waits on assets.
   *
   * Each slot keeps its SHAPE either way: tall left, wide centre, phone right.
   */
  const covers = templates.filter((t) => t.coverImage).slice(0, 3);
  const stack = covers.map((t, i) => ({
    href: `/templates/${t.slug}`,
    label: t.name,
    src: heroArt?.[i] ?? t.coverImage,
    // Purpose-made art is portrait/phone; a cover screenshot is 1280x900.
    w: heroArt?.[i] ? 900 : 1280,
    h: heroArt?.[i] ? 1200 : 900,
  }));

  const stats: Stat[] = [
    { label: "Templates", value: String(total), href: "/templates", icon: I.grid, tone: "g" },
    { label: "Creators", value: String(creatorCount), href: "/templates", icon: I.users, tone: "p" },
    { label: "Free", value: String(freeCount), href: "/templates/free", icon: I.spark, tone: "a" },
    {
      label: "Paid",
      value: lowestPaid ? `${paidCount}, from $${lowestPaid}` : String(paidCount),
      href: "/templates/paid", icon: I.tag, tone: "b",
    },
    { label: "Categories", value: `${filledCategories} of ${totalCategories}`, href: "/templates", icon: I.case, tone: "n" },
  ];

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__inner">
        {/* ── left: the pitch ── */}
        <div className="hero__pitch">
          <p className="hero__eyebrow" data-reveal="fade">
            <span className="hero__spark" aria-hidden>✦</span> Kurumera Template Marketplace
          </p>

          <h1 className="hero__title" id="hero-title" data-reveal-group="">
            <span className="hero__line"><span data-reveal="mask">Build it your way.</span></span>
            <span className="hero__line"><span data-reveal="mask">Launch with</span></span>
            <span className="hero__line">
              <span data-reveal="mask"><em className="hero__accent">confidence.</em></span>
            </span>
          </h1>

          <p className="hero__lede" data-reveal="fade">
            Free and premium website templates you can preview live, customize in
            the visual builder, and publish on your own domain.
          </p>

          <div className="hero__search" data-reveal="fade">
            <SearchForm className="searchbox" placeholder="Search templates, industries, styles…" />
          </div>

          {chips.length > 0 && (
            <div className="hero__chips" data-reveal="fade">
              <Link className="hero__chip hero__chip--all" href="/templates">
                <Icon d={I.grid} /> All templates
              </Link>
              {chips.map((c) => (
                <Link key={c.key} className="hero__chip" href={`/templates/category/${c.key}`}>
                  <Icon d={CHIP_ICON[c.key] ?? I.tag} /> {c.label}
                </Link>
              ))}
            </div>
          )}

          {/* Real counts, standing in for the invented review score. */}
          <p className="hero__proof" data-reveal="fade">
            <strong>{total}</strong> templates from <strong>{creatorCount}</strong> creators
            {freeCount > 0 && <> · <strong>{freeCount}</strong> free to keep</>}
            <> · every one free to preview</>
          </p>
        </div>

        {/* ── right: the covers ── */}
        <div className="hero__art" aria-hidden={stack.length === 0}>
          <span className="hero__badge">
            <span className="hero__badge-n">{total}</span>
            <span className="hero__badge-l">templates</span>
          </span>

          <div className="hero__stack">
            {stack.map((sh, i) => (
              <Link
                key={sh.href + i}
                href={sh.href}
                className={`hero__shot hero__shot--${i + 1}`}
                aria-label={sh.label}
                style={{ ["--i" as string]: i }}
              >
                <Image
                  src={sh.src}
                  alt=""
                  width={sh.w}
                  height={sh.h}
                  sizes="(max-width: 1100px) 60vw, 620px"
                  priority={i === 0}
                />
              </Link>
            ))}
          </div>

          <div className="hero__glance">
            <p className="hero__glance-h">Marketplace at a glance</p>
            <ul>
              {stats.map((s) => (
                <li key={s.label}>
                  <Link href={s.href}>
                    <span className={`hero__glance-i hero__glance-i--${s.tone}`} aria-hidden>
                      <Icon d={s.icon} />
                    </span>
                    <span>{s.label}</span>
                    <span className="hero__glance-v">{s.value}</span>
                    <span className="hero__glance-c" aria-hidden>›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

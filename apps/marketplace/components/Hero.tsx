import Image from "next/image";
import Link from "next/link";
import type { Template } from "@/lib/registry";
import { SearchForm } from "./SearchForm";
import { Arrow, Chevron } from "@/components/Icons";

/**
 * Home hero — the pitch on the left, three real template panels fanned on the
 * right, with a counts panel over them.
 *
 * WHAT THE PANELS ARE. /public/art-lumina|nexora|lumensa.png are the three
 * supplied UI shots with their baked-in presentation grounds removed — the
 * originals were rendered on black (and a grey vignette for the phone), so
 * placing them on a light hero drew three hard rectangles instead of three
 * floating screens. The crops are content-only; the shadow and the radius now
 * come from CSS, which is what lets them overlap convincingly.
 *
 * ORDER MATTERS AND IS NOT ARBITRARY: Lumina leads because it is the one panel
 * that shows a COMPLETE storefront — nav, hero, trust row, product grid — which
 * is the argument the page is making. Nexora sits behind-left as the dark
 * counterweight, and Lumensa (a phone) behind-right, so the group reads
 * desktop → tablet → phone without a caption saying so.
 *
 * WHAT IS DELIBERATELY ABSENT: the comp this was built from carried "Trusted by
 * 2,000+ creators" over a row of stock avatars and "4.9/5 from 1,200+ reviews"
 * under five stars. There are eight creators, three installs in total, and no
 * reviews system at all — DetailTabs literally renders "no reviews… no data
 * yet". Printing those figures would be inventing social proof, which is a
 * different activity from designing a hero. The proof line below states the
 * catalogue facts instead, and they are genuinely good ones: every template is
 * free to open live, and half are free to keep.
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
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  heart: "M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1z",
  cal: "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M8 3v4M16 3v4",
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
  portfolio: I.grid, restaurant: I.tag, "real-estate": I.home,
  "health-fitness": I.heart, health: I.heart, events: I.cal,
};

/** A four-point star. Decorative only — never announced. */
function Spark({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M12 0c.6 6.3 5.1 10.8 12 12-6.9 1.2-11.4 5.7-12 12-.6-6.3-5.1-10.8-12-12C6.9 10.8 11.4 6.3 12 0z" />
    </svg>
  );
}

type Stat = { label: string; value: string; href: string; icon: string; tone: string };

/**
 * How many category chips sit on the visible row before "More" takes over.
 *
 * TWO, measured rather than guessed. The row also carries the leading "All
 * categories" chip, so this is four items plus "More". At three the row totalled
 * 661px against a 650px column at 1920 and a 516px column at 1440 — it wrapped
 * at BOTH, which pushed the proof line down and broke the pitch's alignment
 * with the artwork beside it.
 *
 * The comp fits five because its category labels are invented short ones
 * ("Business", "Agency"); ours are real and include "Health & Fitness" at
 * 167px. Two inline plus "More" is the widest arrangement that holds one line
 * at every width the site supports, and every category is still one click away.
 */
const CHIPS_INLINE = 2;

export function Hero({
  templates,
  freeCount,
  paidCount,
  creatorCount,
  filledCategories,
  totalCategories,
  lowestPaid,
  totalViews,
  ratingCount,
  ratingAverage,
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
  /** Real marketplace totals. Each renders only when it has a value. */
  totalViews: number;
  ratingCount: number;
  ratingAverage: number;
  /** Categories that actually contain templates — a chip must lead somewhere. */
  chips: { key: string; label: string }[];
  /** Escape hatch for a page that wants different art. Normally unset — the
   *  three crops below travel with their own intrinsic sizes. */
  heroArt?: string[];
}) {
  const total = templates.length;

  /**
   * The three slots, in z-order of the composition: 1 = the panel in front,
   * 2 = behind-left, 3 = behind-right. Each carries its OWN intrinsic size —
   * the three crops have genuinely different proportions (0.91 / 0.61 / 0.43),
   * and a single hard-coded width/height would make Next reserve the wrong box
   * and shift the layout when each one loads.
   */
  const ART = [
    { src: "/art-lumina.png", w: 896, h: 980 },
    { src: "/art-nexora.png", w: 809, h: 1321 },
    { src: "/art-lumensa.png", w: 638, h: 1494 },
  ];
  const covers = templates.filter((t) => t.coverImage).slice(0, 3);
  const stack = ART.map((a, i) => ({
    href: covers[i] ? `/templates/${covers[i].slug}` : "/templates",
    label: covers[i]?.name ?? "Browse templates",
    src: heroArt?.[i] ?? a.src,
    w: a.w,
    h: a.h,
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

  const inline = chips.slice(0, CHIPS_INLINE);
  const overflow = chips.slice(CHIPS_INLINE);

  return (
    <section className="hero" aria-labelledby="hero-title">
      {/* Atmosphere. One <svg> for the orbit arcs behind the panels, plus four
          stars — all aria-hidden, all pointer-events:none, none of it animated.
          It exists to give the artwork somewhere to sit; a hero that is a
          rectangle of colour makes three floating panels look like a mistake. */}
      <svg className="hero__orbits" viewBox="0 0 900 700" preserveAspectRatio="xMidYMid meet" aria-hidden focusable="false">
        <ellipse cx="450" cy="350" rx="430" ry="330" />
        <ellipse cx="450" cy="350" rx="330" ry="248" className="hero__orbit--dash" />
      </svg>
      <Spark className="hero__spark hero__spark--1" />
      <Spark className="hero__spark hero__spark--2" />
      <Spark className="hero__spark hero__spark--3" />
      <Spark className="hero__spark hero__spark--4" />

      <div className="hero__inner">
        {/* ── left: the pitch ── */}
        <div className="hero__pitch">
          <p className="hero__eyebrow" data-reveal="fade">
            <span className="hero__eyebrow-star" aria-hidden>✦</span> Kurumera Template Marketplace
          </p>

          <h1 className="hero__title" id="hero-title" data-reveal-group="">
            <span className="hero__line"><span data-reveal="mask">Build it your way.</span></span>
            <span className="hero__line"><span data-reveal="mask">Launch with</span></span>
            <span className="hero__line">
              <span data-reveal="mask">
                <em className="hero__accent">
                  confidence.
                  {/* A drawn swash, not a border-bottom: the underline in the
                      comp tapers and overshoots the word at both ends, which a
                      rectangle cannot do. Sits in its own layer so it never
                      affects the line box. */}
                  <svg className="hero__swash" viewBox="0 0 300 18" preserveAspectRatio="none" aria-hidden focusable="false">
                    <path d="M2 12.5C46 5.5 132 2.4 197 5.1c37 1.5 71 4.6 101 8.4" />
                  </svg>
                </em>
              </span>
            </span>
          </h1>

          <p className="hero__lede" data-reveal="fade">
            Free and premium website templates for every idea, industry and ambition.
            Preview any of them live, customize in the visual builder, and publish on
            your own domain.
          </p>

          <div className="hero__search" data-reveal="fade">
            <SearchForm className="searchbox hero__searchbox" placeholder="Search templates, industries, styles…">
              <button type="submit" className="hero__go" aria-label="Search templates">
                <Arrow />
              </button>
            </SearchForm>
          </div>

          {chips.length > 0 && (
            <div className="hero__chips" data-reveal="fade">
              <Link className="hero__chip hero__chip--all" href="/templates">
                <Icon d={I.grid} /> All categories
              </Link>
              {inline.map((c) => (
                <Link key={c.key} className="hero__chip" href={`/templates/category/${c.key}`}>
                  <Icon d={CHIP_ICON[c.key] ?? I.tag} /> {c.label}
                </Link>
              ))}
              {overflow.length > 0 && (
                /* <details>, not a JS menu: the row has to stay one line to
                   match the composition, and the remainder still has to be
                   reachable without script. */
                <details className="hero__more">
                  <summary className="hero__chip hero__chip--more">
                    More <Chevron />
                  </summary>
                  <div className="hero__more-panel">
                    {overflow.map((c) => (
                      <Link key={c.key} className="hero__more-item" href={`/templates/category/${c.key}`}>
                        <Icon d={CHIP_ICON[c.key] ?? I.tag} /> {c.label}
                      </Link>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* THE TRUST ROW, in the comp's shape, with figures the registry can
              back. The comp carried "Trusted by 2,000+ creators" over stock
              avatars and "4.9/5 from 1,200+ reviews" under five stars. There
              are eight creators and the reviews system launched today, so both
              of those would be invented — and inventing them is the one thing
              that would make every true number here worthless too.

              What IS true: how many creators have published, how many times
              the catalogue has been opened, and — as soon as an owner rates
              something — the real average. Each part renders only when it has
              data, so this row grows into the comp's layout rather than
              pretending to already be there. */}
          <div className="hero__trust" data-reveal="fade">
            <span className="hero__trust-block">
              <strong>{creatorCount}</strong>
              <span>{creatorCount === 1 ? "creator" : "creators"} publishing</span>
            </span>
            {totalViews > 0 && (
              <span className="hero__trust-block">
                <strong>{totalViews.toLocaleString()}</strong>
                <span>template {totalViews === 1 ? "view" : "views"}</span>
              </span>
            )}
            {ratingCount > 0 && ratingAverage > 0 ? (
              <span className="hero__trust-block hero__trust-block--rating">
                <span className="hero__trust-stars" aria-hidden>
                  <span className="hero__trust-base">★★★★★</span>
                  <span className="hero__trust-fill" style={{ width: `${(ratingAverage / 5) * 100}%` }}>★★★★★</span>
                </span>
                <span>
                  {ratingAverage.toFixed(1)}/5 from {ratingCount} verified {ratingCount === 1 ? "owner" : "owners"}
                </span>
              </span>
            ) : (
              <span className="hero__trust-block">
                <strong>{freeCount}</strong>
                <span>free to keep · every one free to preview</span>
              </span>
            )}
          </div>
        </div>

        {/* ── right: the panels ── */}
        <div className="hero__art">
          <span className="hero__badge" aria-hidden>
            <svg className="hero__badge-ring" viewBox="0 0 100 100" focusable="false">
              <defs>
                <path id="heroBadgeArc" d="M50 50 m -37 0 a 37 37 0 1 1 74 0 a 37 37 0 1 1 -74 0" />
              </defs>
              <text>
                {/* NOT "CURATED". Publishing is open self-serve through the
                    creator dashboard with no review step, so curation is a
                    claim the product does not make good on. What IS true of
                    every listing is that you can open it live before deciding. */}
                <textPath href="#heroBadgeArc" startOffset="0%">
                  · TEMPLATES · FREE TO PREVIEW · TEMPLATES · FREE TO PREVIEW&nbsp;
                </textPath>
              </text>
            </svg>
            <span className="hero__badge-n">{total}</span>
          </span>

          <div className="hero__stack">
            {stack.map((sh, i) => (
              <Link
                key={sh.src}
                href={sh.href}
                className={`hero__shot hero__shot--${i + 1}`}
                aria-label={`Preview ${sh.label}`}
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

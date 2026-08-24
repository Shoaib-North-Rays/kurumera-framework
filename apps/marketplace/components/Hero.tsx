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

type Stat = { label: string; value: string; href: string };

export function Hero({
  templates,
  freeCount,
  paidCount,
  creatorCount,
  filledCategories,
  totalCategories,
  lowestPaid,
  chips,
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
}) {
  const total = templates.length;
  // Three covers for the stack — the widest, most photographic first.
  const stack = templates.filter((t) => t.coverImage).slice(0, 3);

  const stats: Stat[] = [
    { label: "Templates", value: String(total), href: "/templates" },
    { label: "Creators", value: String(creatorCount), href: "/templates" },
    { label: "Free", value: String(freeCount), href: "/templates/free" },
    {
      label: "Paid",
      value: lowestPaid ? `${paidCount}, from $${lowestPaid}` : String(paidCount),
      href: "/templates/paid",
    },
    { label: "Categories", value: `${filledCategories} of ${totalCategories}`, href: "/templates" },
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
              <Link className="hero__chip hero__chip--all" href="/templates">All templates</Link>
              {chips.map((c) => (
                <Link key={c.key} className="hero__chip" href={`/templates/category/${c.key}`}>
                  {c.label}
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
            {stack.map((t, i) => (
              <Link
                key={t.slug}
                href={`/templates/${t.slug}`}
                className={`hero__shot hero__shot--${i + 1}`}
                aria-label={t.name}
              >
                <Image
                  src={t.coverImage}
                  alt=""
                  width={1280}
                  height={900}
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

import Image from "next/image";
import Link from "next/link";
import type { Template } from "@/lib/registry";
import { WallAutoScroll } from "./WallAutoScroll";

/**
 * Editorial media wall — a deterministic asymmetric composition, NOT a carousel.
 *
 * MEASURED FROM THE REFERENCE at ~1907x773:
 *   row 1  : [clipped ~320] 24 [640] 24 [640 featured] 24 [clipped ~300]
 *   height : ~640px cards, so row 2 breaks the bottom edge by ~100px
 *   bg     : near-black; the wall is full-bleed, no centred max-width
 *   radius : 8px
 *
 * The left card is clipped by the viewport ON PURPOSE (negative offset on the
 * row), and the right card runs off the other edge. The viewport deliberately
 * does not contain the row — that incompleteness is what makes it read as a
 * wall rather than a slider.
 *
 * The wall drifts slowly and pauses the moment the user engages (pointer over
 * it, focus inside it, wheel, touch or key), resuming only once they are done.
 * It drives scrollLeft rather than a transform, so the rail stays a real scroll
 * container and the user can take over mid-drift.
 *
 * CONTENT NOTE: the reference is carried by commissioned lifestyle photography.
 * This marketplace has no photo library — its only media is the template cover
 * screenshots — so the geometry, cropping, overlay and typography are
 * reconstructed exactly while the imagery is ours. Inventing stock photography
 * for a template marketplace would misrepresent the product.
 */

const FEATURED_TAGS = [
  "Ecommerce",
  "Growth",
  "Conversion",
  "CX Design",
  "Development",
  "Brand Strategy",
];

function Card({
  t,
  className,
  priority,
  objectPosition = "top center",
}: {
  t: Template;
  className: string;
  priority?: boolean;
  objectPosition?: string;
}) {
  return (
    <article className={`ew__card ${className}`}>
      <Link href={`/templates/${t.slug}`} className="ew__hit" aria-label={t.name}>
        {t.coverImage ? (
          <Image
            className="ew__img"
            src={t.coverImage}
            alt=""
            fill
            sizes="640px"
            priority={priority}
            style={{ objectPosition }}
          />
        ) : (
          <span className="ew__fallback" style={{ background: t.coverColor || "#1b1b1b" }} />
        )}
        <span className="ew__caption">
          <span className="ew__caption-name">{t.name}</span>
        </span>
      </Link>
    </article>
  );
}

/** The dark case-study card — the compositional anchor of the reference. */
function Featured({ t }: { t: Template }) {
  return (
    <article className="ew__card ew__card--feature">
      <Link href={`/templates/${t.slug}`} className="ew__hit" aria-label={`${t.name} — case study`}>
        {t.coverImage && (
          <Image className="ew__img ew__img--feature" src={t.coverImage} alt="" fill sizes="640px" priority />
        )}
        {/* Translucent, not opaque: the photograph stays readable underneath. */}
        <span className="ew__scrim" aria-hidden />

        <span className="ew__brand" aria-hidden>
          <span className="ew__brand-mark" />
          kurumera<span className="ew__brand-thin">templates</span>
        </span>

        {/* Sits BEHIND the title, intersecting it — not a badge beside it. */}
        <span className="ew__disc" aria-hidden />

        <span className="ew__feature-body">
          <span className="ew__feature-title">{t.name}</span>
          <span className="ew__feature-by">by {t.author}</span>
          <span className="ew__feature-desc">
            {t.description
              ? t.description.slice(0, 190)
              : `A complete ${t.category || "storefront"} theme — built to launch fast and stay yours.`}
          </span>
          <span className="ew__tags">
            {FEATURED_TAGS.map((tag) => (
              <span className="ew__tag" key={tag}>
                {tag}
              </span>
            ))}
          </span>
        </span>
      </Link>
    </article>
  );
}

export function EditorialWall({ templates }: { templates: Template[] }) {
  if (templates.length < 4) return null;

  // Deterministic slots. The featured card is position 3 in row 1, as measured.
  const r1 = [templates[0], templates[1], templates[2], templates[3]];
  const r2 = [
    templates[4 % templates.length],
    templates[5 % templates.length],
    templates[6 % templates.length],
    templates[7 % templates.length],
  ];

  return (
    <section className="ew" aria-label="Featured templates">
      {/* Focusable + labelled so the overflow is reachable without a pointer.
          Nothing scrolls it automatically. */}
      <div className="ew__rail" tabIndex={0} role="region" aria-label="Template gallery, scroll horizontally">
        <div className="ew__row">
          <Card t={r1[0]} className="ew__card--edgeL" priority />
          <Card t={r1[1]} className="ew__card--lg" priority />
          <Featured t={r1[2]} />
          <Card t={r1[3]} className="ew__card--edgeR" />
        </div>

        {/* Row 2 breaks the bottom edge — the wall continues past the viewport. */}
        <div className="ew__row ew__row--2">
          <Card t={r2[0]} className="ew__card--md" objectPosition="center" />
          <Card t={r2[1]} className="ew__card--lg" objectPosition="center" />
          <Card t={r2[2]} className="ew__card--md" objectPosition="center" />
          <Card t={r2[3]} className="ew__card--lg" objectPosition="center" />
        </div>
      </div>

      <WallAutoScroll selector=".ew__rail" />
    </section>
  );
}

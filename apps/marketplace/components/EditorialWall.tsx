import Image from "next/image";
import { authorLabel } from "@/lib/registry";
import Link from "next/link";
import type { Template } from "@/lib/registry";
import { WallAutoScroll } from "./WallAutoScroll";
import { CursorArrow } from "./CursorArrow";

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

/**
 * A template's own tags, cleaned — never substituted.
 *
 * The data is creator-entered and not all of it is presentable: one live
 * listing carries the tag ": real-estate", which renders as a stray colon and
 * reads as a bug at this size. Malformed entries are DROPPED rather than
 * repaired, because guessing what a creator meant is inventing their content.
 * A template with no usable tags shows none.
 */
const CLEAN_TAG = /^[A-Za-z][A-Za-z0-9 &+-]*$/;
const tagsOf = (t: Template) => t.tags.filter((x) => CLEAN_TAG.test(x.trim())).slice(0, 5);

function priceOf(t: Template): string {
  if (!t.price) return "Free";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency", currency: t.currency || "USD", maximumFractionDigits: 0,
    }).format(t.price);
  } catch {
    return `${t.currency || "USD"} ${t.price}`;
  }
}

/**
 * ONE card treatment, used for every tile.
 *
 * This started as two components — a plain image card plus one elaborate
 * "featured" card — mirroring the reference, which has a single dark case study
 * among photographs. That is right for an agency portfolio and wrong here: on a
 * marketplace every tile is a product someone is deciding whether to buy, so
 * every tile has to answer the same questions. Reserving the name, price,
 * description and tags for one card left the other seven as anonymous pictures.
 */
function Card({
  t,
  priority,
  objectPosition = "top center",
}: {
  t: Template;
  priority?: boolean;
  objectPosition?: string;
}) {
  return (
    <article className="ew__card">
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

        <span className="ew__scrim" aria-hidden />

        <span className="ew__brand">
          <span className="ew__brand-mark" />
          {(t.category || t.type).toUpperCase()}
          <span className="ew__brand-thin">{priceOf(t)}</span>
        </span>

        <span className="ew__disc" aria-hidden />

        <span className="ew__feature-body">
          <span className="ew__feature-title">{t.name}</span>
          <span className="ew__feature-by">by {authorLabel(t.author)}</span>
          <span className="ew__feature-desc">
            {/* NO FALLBACK. Three of the eight listings have description: "",
                and this used to print "A complete <category> theme — built to
                launch fast and stay yours." over them: marketing copy this
                component invented, attributed to a creator who never wrote it.
                An absent description renders as absent. */}
            {t.description ? t.description.slice(0, 150) : null}
          </span>
          {/* The template's OWN tags, and nothing else. There used to be a
              hardcoded fallback here ("Ecommerce / Growth / Conversion") for
              listings with none — service labels invented by this component and
              attributed to someone else's template. A card with no tags simply
              shows none. */}
          {tagsOf(t).length > 0 && (
            <span className="ew__tags">
              {tagsOf(t).map((tag) => (
                <span className="ew__tag" key={tag}>
                  {tag}
                </span>
              ))}
            </span>
          )}
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
      {/* TWO independent scroll containers, not one. The rows drift in opposite
          directions, which is only possible if each owns its own scrollLeft. */}
      <div className="ew__rail ew__rail--1" tabIndex={0} role="region" aria-label="Featured templates, row one">
        {/* No size modifiers: every card is --ew-w by --ew-h. The rail used to
            mix four widths and two heights as an editorial rhythm, which read
            as ragged rather than composed. */}
        <div className="ew__row">
          {r1.map((t, i) => <Card key={`${t.slug}-${i}`} t={t} priority={i < 3} />)}
        </div>
      </div>

      <div className="ew__rail ew__rail--2" tabIndex={0} role="region" aria-label="Featured templates, row two">
        <div className="ew__row ew__row--2">
          {r2.map((t, i) => <Card key={`${t.slug}-${i}`} t={t} objectPosition="center" />)}
        </div>
      </div>

      <CursorArrow selector=".ew" />
      <WallAutoScroll selector=".ew__rail--1" direction="right" />
      <WallAutoScroll selector=".ew__rail--2" direction="left" />
    </section>
  );
}

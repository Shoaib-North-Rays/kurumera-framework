import Image from "next/image";
import Link from "next/link";
import type { Template } from "@/lib/registry";
import { RailAutoScroll } from "./RailAutoScroll";

/**
 * Horizontal mosaic of templates — the marketplace's showcase surface.
 *
 * WHY IT EXISTS NOW AND NOT BEFORE: every listing used to have coverImage:"",
 * so a card could only be a live cross-origin iframe. Iframes cannot be cropped
 * to an editorial ratio, cannot be scaled on hover without reloading layout, and
 * cost a full theme document each. With real covers this becomes an image
 * composition, which is what makes the whole treatment affordable.
 *
 * COMPOSITION: every tile is the SAME size. A showcase is a comparison, and
 * varying the frames makes two designs look different when only the frame
 * changed — the imagery supplies the variety. The rail scrolls horizontally and
 * leaves the next tile partly visible, the cheapest possible "there is more".
 *
 * MOTION, and what each piece earns its place with (nothing here is decorative):
 *   · overlay + copy on hover  -> DISCOVERY. The name, what it is and its tags
 *     are what someone is actually deciding on; showing them on approach beats
 *     making the card a mystery box.
 *   · circular arrow           -> ORIENTATION. States that the tile leads
 *     somewhere, before the click.
 *   · image scale              -> FEEDBACK. Confirms which tile is targeted.
 * All three are also driven by :focus-within, so a keyboard user gets the same
 * information a mouse user does — a hover-only reveal would hide the copy from
 * them entirely.
 *
 * TOUCH: there is no hover on a phone, so the overlay is permanent there rather
 * than unreachable (see mosaic.css). The information is the point; the motion is
 * only how it arrives.
 */

function priceLabel(t: Template): string {
  if (!t.price) return "Free";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: t.currency || "USD",
      maximumFractionDigits: 0,
    }).format(t.price);
  } catch {
    return `${t.currency || "USD"} ${t.price}`;
  }
}

export function TemplateMosaic({
  templates,
  eyebrow,
  title,
  href = "/templates",
  hrefLabel = "All templates",
}: {
  templates: Template[];
  eyebrow?: string;
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  if (templates.length === 0) return null;

  return (
    <section className="mos" aria-labelledby="mos-title">
      <div className="mos__head">
        <div>
          {eyebrow && <p className="mos__eyebrow">{eyebrow}</p>}
          <h2 className="mos__title" id="mos-title" data-reveal="mask">
            {title}
          </h2>
        </div>
        <Link className="mos__all mi-link mi-arrow" href={href}>
          {hrefLabel}
          <span className="mi-arrow__glyph" aria-hidden>
            →
          </span>
        </Link>
      </div>

      {/*
        A scroll container is not focusable by default, so a keyboard user cannot
        scroll it. tabIndex + a role/label make the rail reachable and announced.
      */}
      <div
        className="mos__rail"
        role="region"
        aria-label={`${title} — scrollable`}
        tabIndex={0}
        data-reveal-group=""
      >
        {templates.map((t) => (
          <article
            key={t.slug}
            className="mos__tile"
            data-reveal="scale"
          >
            <div className="mos__frame">
              {t.coverImage ? (
                <Image
                  className="mos__img"
                  src={t.coverImage}
                  alt=""
                  width={1280}
                  height={900}
                  sizes="(max-width: 720px) 80vw, 30rem"
                  /* Decorative: the accessible name comes from the link below,
                     so alt="" avoids announcing the same thing twice. */
                />
              ) : (
                <div
                  className="mos__fallback"
                  style={{ background: t.coverColor || "var(--sunken)" }}
                  aria-hidden
                >
                  {t.name}
                </div>
              )}

              <div className="mos__veil" aria-hidden />

              <div className="mos__body">
                <p className="mos__meta">
                  {t.category || t.type} · {priceLabel(t)}
                </p>
                <h3 className="mos__name">
                  {/* The whole tile is clickable via the stretched link, but the
                      link itself stays on the title so the accessible name is
                      the template, not the tile's entire text content. */}
                  <Link className="mos__link" href={`/templates/${t.slug}`}>
                    {t.name}
                  </Link>
                </h3>
                {t.description && <p className="mos__desc">{t.description}</p>}
                {t.tags.length > 0 && (
                  <ul className="mos__tags">
                    {t.tags.slice(0, 4).map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                )}
              </div>

              <span className="mos__go" aria-hidden>
                →
              </span>
            </div>
          </article>
        ))}
      </div>

      {/* Drifts once the rail is on screen; stops for good on any interaction. */}
      <RailAutoScroll selector=".mos__rail" />
    </section>
  );
}

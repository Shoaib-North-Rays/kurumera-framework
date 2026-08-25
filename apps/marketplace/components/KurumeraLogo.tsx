import Image from "next/image";

/**
 * The Kurumera brand mark and lockup.
 *
 * DUPLICATED, BY NECESSITY, from theplantsmall-admin-frontend's
 * `src/components/brand/KurumeraLogo.tsx`. That file is the origin and says it
 * is "the ONE place the logo is drawn" — true within its own app, but this is a
 * separate repository and cannot import from it. The same note there already
 * accepts this for `app/icon.svg` and `public/brand/kurumera-mark.svg`. If the
 * official artwork changes, it changes in the admin frontend first and then
 * here and in the marketplace; there is no build step that would catch a drift,
 * so it is worth grepping for `kurumera-k.webp` before assuming one copy is
 * the only copy — there are three: admin frontend, website-builder, and here.
 *
 * TWO FORMS, and they are not interchangeable:
 *
 *   · `KurumeraLogo` renders the DESIGNER'S OWN ARTWORK — mark and wordmark
 *     recomposed from separate crops, with the tagline dropped so "kurumera"
 *     stays legible at header sizes. The origin file records this as preferred
 *     on marketing and auth surfaces (Sajid, 2026-07-23), which is what this
 *     page is.
 *   · `KurumeraMark` is a vector recreation, for the sizes where a raster
 *     wordmark would turn to mush — a 20px chip inside an illustration, a
 *     favicon, a monochrome tile.
 *
 * THE WORDMARK IS LOWERCASE. The official one is all-lowercase "kurumera"; a
 * capitalised K is a different logo. This page previously set it in title case
 * next to a hand-drawn mark, which was wrong twice over.
 */

/* Brand fills, from the origin file. Slightly different greens per facet give
   the depth the original artwork gets from a gradient, without needing <defs>
   — so instances can repeat anywhere without SVG id collisions. */
const SIDE = "#0A6B4E";
const SLAB = "#15B586";
const ARM_UP = "#1FCE93";
const ARM_DOWN = "#0E9468";
const ORANGE = "#F6A21E";

export function KurumeraMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden className={className} focusable="false">
      {/* left slab — darker side face behind the front face */}
      <path d="M14 14 L22 8 L22 84 L14 90 Z" fill={SIDE} fillOpacity={0.55} />
      <path d="M22 8 L36 12 L36 88 L22 84 Z" fill={SLAB} />
      {/* upper arm */}
      <path d="M38 58 L74 10 L90 10 L54 58 Z" fill={ARM_UP} />
      {/* lower arm */}
      <path d="M38 64 L54 64 L78 90 L62 90 Z" fill={ARM_DOWN} />
      {/* summit triangle */}
      <path d="M40 56 L54 56 L47 42 Z" fill={ORANGE} />
    </svg>
  );
}

/**
 * The horizontal lockup for headers and footers.
 *
 * Both dimensions are pinned from each asset's intrinsic ratio, so the header
 * does not reflow as the images stream in — a logo that jumps on load is the
 * first thing a visitor sees go wrong.
 */
export function KurumeraLogo({ height = 30, className = "" }: { height?: number; className?: string }) {
  const wordHeight = Math.round(height * 0.52);
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: Math.round(height * 0.24) }}>
      <Image
        src="/brand/kurumera-k.webp"
        alt=""
        height={height}
        width={Math.round(height * (248 / 350))}
        style={{ height, width: "auto" }}
        className="block select-none"
        priority
        draggable={false}
      />
      <Image
        src="/brand/kurumera-wordmark.webp"
        alt="Kurumera"
        height={wordHeight}
        width={Math.round(wordHeight * (740 / 170))}
        style={{ height: wordHeight, width: "auto" }}
        className="block select-none"
        priority
        draggable={false}
      />
    </span>
  );
}

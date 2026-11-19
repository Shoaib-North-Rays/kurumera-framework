import type { Template } from "@/lib/registry";
import { authorLabel } from "@/lib/registry";

const SITE = "https://marketplace.kurumera.com";

/**
 * Structured data for a template detail page.
 *
 * The app had none — no JSON-LD anywhere — while the detail page already
 * carried every field Google's Product rich result asks for: name, description,
 * image, author, price, currency, and a rating that `lib/registry.ts` already
 * normalises. Emitting it costs nothing and is the difference between a plain
 * blue link and a result with a price and a star rating on it, which for a
 * marketplace is most of the click.
 *
 * TWO RULES HELD HERE, because getting them wrong is worse than omitting the
 * markup entirely — Google penalises structured data that disagrees with the
 * page:
 *
 *   · `aggregateRating` is emitted ONLY when a real rating exists. Most
 *     listings have none, and a `ratingValue: 0` / `reviewCount: 0` is both a
 *     spec violation and a claim the page does not make.
 *   · Everything here is already visible on the page. Nothing is invented for
 *     the crawler's benefit.
 */
export function TemplateJsonLd({ t }: { t: Template }) {
  const url = `${SITE}/templates/${t.slug}`;
  const rated = t.rating && t.rating.count > 0;

  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: t.name,
    url,
    ...(t.description ? { description: t.description.slice(0, 500) } : {}),
    ...(t.coverImage ? { image: [t.coverImage] } : {}),
    brand: { "@type": "Brand", name: "Kurumera" },
    ...(t.author ? { author: { "@type": "Person", name: authorLabel(t.author) } } : {}),
    ...(t.category ? { category: t.category } : {}),
    offers: {
      "@type": "Offer",
      url,
      price: String(t.price || 0),
      priceCurrency: t.currency || "USD",
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "Kurumera" },
    },
    ...(rated
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: t.rating.average,
            reviewCount: t.rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  // Breadcrumbs are already rendered on this page; this just makes them
  // machine-readable so the result shows the path rather than a bare URL.
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Templates", item: `${SITE}/templates` },
      { "@type": "ListItem", position: 3, name: t.name, item: url },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(product) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(crumbs) }} />
    </>
  );
}

/** JSON for an inline <script type="application/ld+json">. A listing's name and
 *  description are the creator's text, and a `</script>` in them ended this
 *  element and ran as markup on the marketplace, where the session token lives
 *  (content audit XS-06). Escaping `<`, `>` and `&` keeps the JSON identical to
 *  a parser and inert to the HTML tokenizer. */
function jsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LINE_SEPARATORS, (c) => `\\u${c.charCodeAt(0).toString(16)}`);
}

/** U+2028 and U+2029, built from their code points: typed into a regular
 *  expression they would end the line it is written on. */
const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028, 0x2029)}]`, "g");

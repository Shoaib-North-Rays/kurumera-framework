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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(product) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />
    </>
  );
}

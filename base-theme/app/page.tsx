import type { ProductListItem, Collection } from "@kurumera/storefront";
import { getStore } from "@/lib/kurumera";
import { getSettings } from "@/lib/settings";
import { FeaturedProducts } from "@/sections/FeaturedProducts";
import { FeaturedCollections } from "@/sections/FeaturedCollections";
import { ValueProps } from "@/sections/ValueProps";
import { Testimonials } from "@/sections/Testimonials";

/**
 * home template
 *
 * TWO editing systems, and it matters which one you reach for:
 *
 *   1. ThemeSettings (lib/settings.ts, read via getSettings() below) — a FIXED
 *      built-in set: colors, fonts, logo, announcement bar, hero, value props,
 *      section titles. Already has its own editor (dashboard → Customize).
 *      Read these through getSettings(); do NOT wrap them in Editable*.
 *
 *   2. @kurumera/editable — for ANY content you add that ThemeSettings doesn't
 *      cover. See sections/Testimonials.tsx for the worked example.
 *
 * If you add a new headline, image, CTA or list and write it as plain JSX,
 * the merchant can NEVER edit it — they'd need a developer for every copy
 * change. Wrap it. That is the whole point of the Editable* components.
 */
export default async function HomePage() {
  const kurumera = await getStore();
  const [products, collections, settings] = await Promise.all([
    kurumera.products.list({ limit: 8 }).then((r) => (r.results ?? []) as ProductListItem[]).catch(() => [] as ProductListItem[]),
    kurumera.collections.list({ limit: 6 }).then((r) => ((r.results ?? r) as Collection[])).catch(() => [] as Collection[]),
    getSettings(),
  ]);
  const { hero, featured, valueProps } = settings;

  return (
    <>
      {hero.show && (
        <section className="hero">
          {hero.eyebrow && <span className="hero__eyebrow">{hero.eyebrow}</span>}
          <h1 className="hero__title">{hero.title}</h1>
          {hero.lede && <p className="hero__lede">{hero.lede}</p>}
          <div className="hero__cta">
            {hero.primary.label && <a className="btn btn--primary" href={hero.primary.href}>{hero.primary.label}</a>}
            {hero.secondary.label && <a className="btn btn--ghost" href={hero.secondary.href}>{hero.secondary.label}</a>}
          </div>
        </section>
      )}

      <ValueProps items={valueProps} />
      <FeaturedCollections collections={collections} title={featured.collectionsTitle} />
      <div id="featured">
        <FeaturedProducts products={products} title={featured.productsTitle} href="/search" />
      </div>
      <Testimonials />
    </>
  );
}

import type { ProductListItem, Collection } from "@kurumera/storefront";
import { getStore } from "@/lib/kurumera";
import { getSettings } from "@/lib/settings";
import { FeaturedProducts } from "@/sections/FeaturedProducts";
import { FeaturedCollections } from "@/sections/FeaturedCollections";
import { ValueProps } from "@/sections/ValueProps";

/** home template */
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
    </>
  );
}

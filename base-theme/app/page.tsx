import type { ProductListItem, Collection } from "@kurumera/storefront";
import { getStore } from "@/lib/kurumera";
import { FeaturedProducts } from "@/sections/FeaturedProducts";
import { FeaturedCollections } from "@/sections/FeaturedCollections";
import { ValueProps } from "@/sections/ValueProps";

/** home template */
export default async function HomePage() {
  const kurumera = await getStore();
  const [products, collections] = await Promise.all([
    kurumera.products.list({ limit: 8 }).then((r) => (r.results ?? []) as ProductListItem[]).catch(() => [] as ProductListItem[]),
    kurumera.collections.list({ limit: 6 }).then((r) => ((r.results ?? r) as Collection[])).catch(() => [] as Collection[]),
  ]);

  return (
    <>
      <section className="hero">
        <span className="hero__eyebrow">New season</span>
        <h1 className="hero__title">Thoughtfully made, delivered to your door.</h1>
        <p className="hero__lede">Explore our latest collection — quality pieces at honest prices, shipped fast.</p>
        <div className="hero__cta">
          <a className="btn btn--primary" href="/search">Shop all</a>
          <a className="btn btn--ghost" href="#featured">New arrivals</a>
        </div>
      </section>

      <ValueProps />
      <FeaturedCollections collections={collections} />
      <div id="featured">
        <FeaturedProducts products={products} title="New arrivals" href="/search" />
      </div>
    </>
  );
}

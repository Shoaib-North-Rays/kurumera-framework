import type { ProductListItem } from "@kurumera/storefront";
import { getStore } from "@/lib/kurumera";
import { ProductCard } from "@/components/ProductCard";

/** collection template */
export default async function CollectionPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const kurumera = await getStore();
  const collection = await kurumera.collections.getByHandle(handle);

  const products: ProductListItem[] = Array.isArray(collection.products)
    ? collection.products
    : (collection.products?.results ?? []);

  return (
    <section className="section">
      <div className="section__head">
        <h1 className="section__title">{collection.title}</h1>
        <span className="section__count">{products.length} product{products.length === 1 ? "" : "s"}</span>
      </div>
      {collection.description ? (
        <div className="prose collection__desc" dangerouslySetInnerHTML={{ __html: collection.description }} />
      ) : null}
      <div className="grid">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

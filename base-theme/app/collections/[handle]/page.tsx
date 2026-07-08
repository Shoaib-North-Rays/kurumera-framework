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
      <h1 className="section__title">{collection.title}</h1>
      {collection.description ? (
        <div className="prose" dangerouslySetInnerHTML={{ __html: collection.description }} />
      ) : null}
      <div className="grid">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

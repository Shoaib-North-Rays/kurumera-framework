import type { ProductListItem } from "@kurumera/storefront";
import { ProductCard } from "@/components/ProductCard";

export function FeaturedProducts({
  products,
  title = "Featured",
}: {
  products: ProductListItem[];
  title?: string;
}) {
  if (!products.length) return null;
  return (
    <section className="section">
      <h2 className="section__title">{title}</h2>
      <div className="grid">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

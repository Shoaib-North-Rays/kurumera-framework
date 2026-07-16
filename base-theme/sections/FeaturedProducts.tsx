import Link from "next/link";
import type { ProductListItem } from "@kurumera/storefront";
import { ProductCard } from "@/components/ProductCard";
import { ArrowRight } from "@/components/Icon";

export function FeaturedProducts({
  products,
  title = "Featured",
  href,
}: {
  products: ProductListItem[];
  title?: string;
  href?: string;
}) {
  if (!products.length) return null;
  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">{title}</h2>
        {href && (
          <Link href={href} className="section__more">View all <ArrowRight /></Link>
        )}
      </div>
      <div className="grid">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

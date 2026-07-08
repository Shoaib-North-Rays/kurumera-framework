import Link from "next/link";
import type { ProductListItem } from "@kurumera/storefront";
import { Price } from "./Price";

export function ProductCard({ product }: { product: ProductListItem }) {
  const img = product.featured_image?.src ?? null;
  return (
    <Link href={`/products/${product.handle}`} className="card">
      <div className="card__media">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={product.featured_image?.alt ?? product.title} loading="lazy" />
        ) : (
          <div className="card__media--empty" aria-hidden="true" />
        )}
        {product.is_deal ? <span className="card__badge">Sale</span> : null}
      </div>
      <div className="card__body">
        <h3 className="card__title">{product.title}</h3>
        <Price amount={product.min_price} compareAt={product.min_compare_at_price} />
      </div>
    </Link>
  );
}

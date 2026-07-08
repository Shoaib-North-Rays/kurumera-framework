import { notFound } from "next/navigation";
import { KurumeraError } from "@kurumera/storefront";
import { getStore } from "@/lib/kurumera";
import { Price } from "@/components/Price";

/** product template */
export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const kurumera = await getStore();

  let product;
  try {
    product = await kurumera.products.getByHandle(handle);
  } catch (e) {
    if (e instanceof KurumeraError && e.status === 404) notFound();
    throw e;
  }

  return (
    <article className="pdp">
      <div className="pdp__media">
        {product.featured_image?.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.featured_image.src} alt={product.featured_image.alt ?? product.title} />
        ) : (
          <div className="pdp__media--empty" aria-hidden="true" />
        )}
      </div>
      <div className="pdp__info">
        <h1 className="pdp__title">{product.title}</h1>
        <Price amount={product.min_price} compareAt={product.min_compare_at_price} />
        {product.body_html ? (
          <div className="pdp__body" dangerouslySetInnerHTML={{ __html: product.body_html }} />
        ) : null}
        <button className="btn" disabled={!product.available}>
          {product.available ? "Add to cart" : "Sold out"}
        </button>
      </div>
    </article>
  );
}

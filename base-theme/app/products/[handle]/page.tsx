import { notFound } from "next/navigation";
import { KurumeraError } from "@kurumera/storefront";
import { getStore } from "@/lib/kurumera";
import { Price } from "@/components/Price";
import { AddToCart } from "@/components/AddToCart";
import { TruckIcon, RefreshIcon, ShieldIcon } from "@/components/Icon";

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

  // Resolve a variant to add to the cart. The base template adds the first
  // available variant; a theme with multiple options should render a selector.
  const p = product as unknown as {
    variants?: { id?: string | number; available?: boolean }[];
    default_variant_id?: string | number;
    variant_id?: string | number;
  };
  const variants = p.variants ?? [];
  const chosen = variants.find((v) => v.available) ?? variants[0];
  const defaultVariantId = String(
    chosen?.id ?? p.default_variant_id ?? p.variant_id ?? "",
  ) || undefined;
  const hasVariants = variants.length > 1;

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
        <AddToCart variantId={defaultVariantId} available={!!product.available} />
        {hasVariants && (
          <p className="pdp__variant-note">
            This product has multiple options — extend this template with a variant selector.
          </p>
        )}
        <div className="trust">
          <div className="trust__row"><TruckIcon /> <span><b>Free shipping</b> on qualifying orders</span></div>
          <div className="trust__row"><RefreshIcon /> <span><b>Easy returns</b> within 30 days</span></div>
          <div className="trust__row"><ShieldIcon /> <span><b>Secure checkout</b> — encrypted payment</span></div>
        </div>
      </div>
    </article>
  );
}

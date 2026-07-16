import Link from "next/link";
import type { Collection } from "@kurumera/storefront";
import { ArrowRight } from "@/components/Icon";

/** A visual grid of collections linking into each collection page. */
export function FeaturedCollections({ collections, title = "Shop by category" }: { collections: Collection[]; title?: string }) {
  const list = collections.filter(Boolean).slice(0, 6);
  if (!list.length) return null;
  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">{title}</h2>
      </div>
      <div className="collections">
        {list.map((c) => {
          const img =
            (c as { image?: { src?: string } }).image?.src ??
            (c.featured_image as { src?: string } | undefined)?.src ??
            null;
          return (
            <Link key={c.id ?? c.handle} href={`/collections/${c.handle}`} className="collection-card">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt={c.title} loading="lazy" />
              ) : (
                <div className="collection-card__empty" aria-hidden="true" />
              )}
              <div className="collection-card__label">
                <span>{c.title}</span>
                <ArrowRight />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

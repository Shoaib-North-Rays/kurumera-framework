import Link from "next/link";
import { getStore } from "@/lib/kurumera";
import { ProductCard } from "@/components/ProductCard";
import { TrackSearch } from "@/components/Analytics";
import type { SearchResults } from "@kurumera/storefront";

/** search template */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const kurumera = await getStore();
  // Cross-entity search — the backend returns products AND collections together,
  // not a Paginated<T> page (see SearchResults).
  const { products, collections }: SearchResults = q
    ? await kurumera.search.query(q, { limit: 24 })
    : { query: "", limit: 24, products: [], collections: [] };
  const totalResults = products.length + collections.length;

  return (
    <section className="section">
      {/* SEARCH, plus SEARCH_NO_RESULTS when nothing matched — the query a
          shopper typed and the store could not answer is the more actionable
          half of search analytics. Renders nothing. */}
      <TrackSearch query={q} results={totalResults} />
      <h1 className="section__title">Search</h1>
      <form action="/search" method="get" className="search-form">
        <input name="q" defaultValue={q} placeholder="Search products…" aria-label="Search" />
        <button className="btn" type="submit">
          Search
        </button>
      </form>
      {q ? (
        <p className="muted">
          {totalResults} result{totalResults === 1 ? "" : "s"} for “{q}”
        </p>
      ) : null}
      {collections.length > 0 && (
        <div className="search-collections">
          {collections.map((c) => (
            <Link key={c.handle} href={`/collections/${c.handle}`} className="search-collections__item">
              {c.title}
            </Link>
          ))}
        </div>
      )}
      <div className="grid">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

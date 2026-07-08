import { kurumera } from "@/lib/kurumera";
import { ProductCard } from "@/components/ProductCard";

/** search template */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = q ? (await kurumera.search.query(q, { limit: 24 })).results : [];

  return (
    <section className="section">
      <h1 className="section__title">Search</h1>
      <form action="/search" method="get" className="search-form">
        <input name="q" defaultValue={q} placeholder="Search products…" aria-label="Search" />
        <button className="btn" type="submit">
          Search
        </button>
      </form>
      {q ? (
        <p className="muted">
          {results.length} result{results.length === 1 ? "" : "s"} for “{q}”
        </p>
      ) : null}
      <div className="grid">
        {results.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

import { kurumera } from "@/lib/kurumera";
import { FeaturedProducts } from "@/sections/FeaturedProducts";

/** home template */
export default async function HomePage() {
  const { results } = await kurumera.products.list({ limit: 8 });
  return (
    <>
      <section className="hero">
        <h1 className="hero__title">Welcome to the store</h1>
        <p className="hero__lede">Discover our latest products.</p>
        <a className="btn" href="/search">
          Shop all
        </a>
      </section>
      <FeaturedProducts products={results} title="New arrivals" />
    </>
  );
}

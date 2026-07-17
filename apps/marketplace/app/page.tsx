import Link from "next/link";
import { fetchTemplates, categoryCounts, matchesCategory, CATEGORIES, isFree, type Template } from "@/lib/registry";
import { TemplateCard } from "@/components/TemplateCard";
import { LivePreview } from "@/components/LivePreview";
import { Search, Arrow, Bolt, Shield, Layers, Grid } from "@/components/Icons";

const SEARCH_CHIPS = ["Restaurant templates", "Ecommerce templates", "Dark portfolio", "Free agency templates", "One-page landing pages"];
const TRUST = [
  { icon: Grid, title: "Professionally designed", body: "Every template is crafted to a high standard — no generic themes." },
  { icon: Layers, title: "Customize without limits", body: "Open any template in the visual builder and make it yours." },
  { icon: Bolt, title: "Publish in a click", body: "From template to live site with your own domain in minutes." },
  { icon: Shield, title: "Free & premium", body: "Start free, or buy a premium template — you always own your site." },
];

function Row({ title, eyebrow, href, items }: { title: string; eyebrow: string; href: string; items: Template[] }) {
  if (!items.length) return null;
  return (
    <section className="section">
      <div className="wrap">
        <div className="section__head">
          <div><span className="eyebrow">{eyebrow}</span><h2 className="section__title">{title}</h2></div>
          <Link className="section__more" href={href}>View all <Arrow /></Link>
        </div>
        <div className="tpl-grid">{items.slice(0, 4).map((t) => <TemplateCard key={t.slug} t={t} />)}</div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const templates = await fetchTemplates();
  const counts = categoryCounts(templates);
  const collage = templates.slice(0, 4);
  const featured = templates.slice(0, 4);
  const free = templates.filter(isFree).slice(0, 4);
  const creators = Array.from(new Set(templates.map((t) => t.author)))
    .map((name) => ({ name, count: templates.filter((t) => t.author === name).length }))
    .sort((a, b) => b.count - a.count).slice(0, 6);

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="wrap hero__grid">
          <div>
            <span className="hero__eyebrow"><span className="dot" /> Kurumera Template Marketplace</span>
            <h1>Find the perfect website template.<br /><span className="accent">Customize it without limits.</span></h1>
            <p className="hero__lede">Explore professionally designed free and premium templates for businesses, stores, portfolios, agencies, restaurants, and more.</p>
            <div className="hero__cta">
              <Link className="btn btn--primary btn--lg" href="/templates">Browse Templates <Arrow /></Link>
              <Link className="btn btn--secondary btn--lg" href="#">Start from Scratch</Link>
            </div>
            <form className="hero__search searchbox" action="/templates" role="search">
              <Search />
              <input className="input" type="search" name="q" placeholder="Search templates, industries, styles, or features…" aria-label="Search templates" />
            </form>
            <div className="hero__chips">
              {SEARCH_CHIPS.map((c) => <Link key={c} className="chip" href={`/templates?q=${encodeURIComponent(c)}`}>{c}</Link>)}
            </div>
          </div>
          <div className="collage">
            {collage.map((t) => <div key={t.slug} className="collage__item"><LivePreview slug={t.slug} name={t.name} /></div>)}
            {collage.length === 0 && [0, 1, 2, 3].map((i) => <div key={i} className="collage__item"><span className="frame__ph">K</span></div>)}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <div><span className="eyebrow">Browse by category</span><h2 className="section__title">Explore by industry</h2></div>
            <Link className="section__more" href="/templates">All templates <Arrow /></Link>
          </div>
          <div className="cat-grid">
            {CATEGORIES.map((c) => {
              const n = counts[c.key] || 0;
              const sample = templates.find((t) => matchesCategory(t, c.key));
              return (
                <Link key={c.key} href={`/templates/category/${c.key}`} className="cat-card">
                  <div className="cat-card__thumb">
                    {sample ? <LivePreview slug={sample.slug} name={c.label} base={1000} /> : <span className="frame__ph">{c.label[0]}</span>}
                  </div>
                  <div>
                    <div className="cat-card__name">{c.label}</div>
                    <div className="cat-card__count">{n} template{n === 1 ? "" : "s"}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <Row eyebrow="Featured" title="Featured templates" href="/templates" items={featured} />
      <Row eyebrow="Free" title="Free templates" href="/templates/free" items={free} />

      {/* TOP CREATORS */}
      {creators.length > 0 && (
        <section className="section">
          <div className="wrap">
            <div className="section__head"><div><span className="eyebrow">Top creators</span><h2 className="section__title">Designers on Kurumera</h2></div></div>
            <div className="cat-grid">
              {creators.map((c) => (
                <div key={c.name} className="cat-card" style={{ minHeight: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--mint)", color: "var(--green-dark)", display: "grid", placeItems: "center", fontFamily: "var(--font-head)", fontWeight: 800 }}>{c.name[0]?.toUpperCase()}</span>
                    <div>
                      <div className="cat-card__name">{c.name}</div>
                      <div className="cat-card__count">{c.count} template{c.count === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* BUILD FROM SCRATCH */}
      <section className="section">
        <div className="wrap">
          <div style={{ background: "var(--mint)", border: "1px solid var(--border)", borderRadius: 18, padding: "44px 32px", textAlign: "center" }}>
            <h2 className="section__title">Prefer a blank canvas?</h2>
            <p className="section__sub" style={{ margin: "10px auto 0" }}>Start from scratch and build your site section by section in the Kurumera visual builder.</p>
            <div style={{ marginTop: 22 }}><Link className="btn btn--primary btn--lg" href="#"><Bolt /> Start from Scratch</Link></div>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="section section--tight">
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 22 }} className="trust-grid">
            {TRUST.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <span style={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: 11, background: "var(--mint)", color: "var(--green-dark)", marginBottom: 12 }}><Icon /></span>
                <h3 style={{ fontSize: 16.5, marginBottom: 6 }}>{title}</h3>
                <p className="muted" style={{ fontSize: 14 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

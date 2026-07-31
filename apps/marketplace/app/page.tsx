import Link from "next/link";
import {
  fetchTemplates, categoryCounts, matchesCategory, CATEGORIES, isFree, isBuilder, priceLabel,
  featureLabels, categoryLabel, livePreviewUrl, builderPreviewUrl, BUILDER_ORIGIN, type Template,
} from "@/lib/registry";
import { TemplateCard } from "@/components/TemplateCard";
import { LivePreview } from "@/components/LivePreview";
import { Search, Arrow, Bolt, Shield, Layers, Grid, Devices, Headset } from "@/components/Icons";

const SEARCH_CHIPS = ["Restaurant templates", "Ecommerce templates", "Dark portfolio", "Free agency templates", "One-page landing pages"];

const WHY = [
  { icon: Grid, title: "Professionally designed", body: "No generic themes — every template is crafted to a high standard." },
  { icon: Layers, title: "Customize without limits", body: "Open any template in the visual builder and make it yours." },
  { icon: Devices, title: "Fully responsive", body: "Looks right on desktop, tablet, and phone out of the box." },
  { icon: Bolt, title: "Publish in a click", body: "From template to live site on your own domain in minutes." },
  { icon: Shield, title: "Own what you build", body: "Free or paid, your site is yours — no lock-in." },
  { icon: Headset, title: "Real support", body: "Reach a human at support@kurumera.com when you need one." },
];

const FAQ = [
  {
    q: "How do I use a template I get from Kurumera?",
    a: "Every template has a live preview, so you know exactly what you're getting before you decide. Free templates install and customize right away; paid templates unlock with a license key issued after checkout, which you'll use to install and clone the source into the visual builder.",
  },
  {
    q: "How does pricing and checkout work?",
    a: "Each creator sets their own template's price — free or paid, shown up front before you buy. Payments are handled by Stripe. Keep your license key after a purchase; you'll need it if you ever reinstall the template.",
  },
  {
    q: "What can I do with a template once I own it?",
    a: "Install it, customize it fully in the visual builder, and publish it live on your own domain. What you build is yours.",
  },
  {
    q: "Can I sell my own templates on Kurumera?",
    a: "Yes — publish through the creator dashboard. You keep ownership of your work and set your own price; the marketplace lists it for others to install under the platform's terms.",
  },
  {
    q: "Who do I contact with questions?",
    a: "Reach us any time at support@kurumera.com.",
  },
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
  const popular = templates.slice(0, 4); // fetchTemplates() already sorts by installs desc — this IS the top 4
  const free = templates.filter(isFree).slice(0, 4);
  const top = templates[0];
  const creators = Array.from(new Set(templates.map((t) => t.author)))
    .map((name) => ({ name, count: templates.filter((t) => t.author === name).length }))
    .sort((a, b) => b.count - a.count).slice(0, 6);
  const allCreatorsCount = new Set(templates.map((t) => t.author)).size;
  const categoriesCovered = CATEGORIES.filter((c) => (counts[c.key] || 0) > 0).length;

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
              <Link className="btn btn--secondary btn--lg" href={BUILDER_ORIGIN}>Start from Scratch</Link>
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
            {collage.map((t) => (
              <div key={t.slug} className="collage__item">
                {t.category && (
                  <span className="collage__badge"><span><Grid /></span>{categoryLabel(t.category)}</span>
                )}
                <LivePreview slug={t.slug} name={t.name} />
              </div>
            ))}
            {collage.length === 0 && [0, 1, 2, 3].map((i) => <div key={i} className="collage__item"><span className="frame__ph">K</span></div>)}
          </div>
        </div>
      </section>

      {/* HONEST STATS */}
      {templates.length > 0 && (
        <section className="section section--tight">
          <div className="wrap">
            <div className="stats">
              <div className="stats__lead"><span><Shield /></span>Trusted by creators building real stores</div>
              <div className="stats__item"><b>{templates.length}+</b><span>Templates published</span></div>
              <div className="stats__item"><b>{categoriesCovered}</b><span>Industries covered</span></div>
              <div className="stats__item"><b>{allCreatorsCount}</b><span>Creators publishing</span></div>
            </div>
          </div>
        </section>
      )}

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

      <Row eyebrow="Popular" title="Most-installed templates" href="/templates?sort=installs" items={popular} />

      {/* SPOTLIGHT — the single most-installed template, real data only */}
      {top && (
        <section className="section">
          <div className="wrap">
            <div className="spotlight">
              <div className="spotlight__grid">
                <div className="spotlight__body">
                  <span className="spotlight__eyebrow"><Bolt /> Most installed</span>
                  {top.category && <div className="spotlight__cat">{categoryLabel(top.category)}</div>}
                  <h2>{top.name}</h2>
                  {top.description && <p className="spotlight__desc">{top.description}</p>}
                  {featureLabels(top, 4).length > 0 && (
                    <div className="spotlight__feats">
                      {featureLabels(top, 4).map((f) => <span key={f}>{f}</span>)}
                    </div>
                  )}
                  <div className="spotlight__meta">
                    <span>by <b style={{ fontSize: 14.5 }}>{top.author}</b></span>
                    <span><b>{top.installs.toLocaleString()}</b> installs</span>
                    <span><b>{priceLabel(top)}</b></span>
                  </div>
                  <Link className="btn btn--primary btn--lg" href={`/templates/${top.slug}`}>Explore {top.name} <Arrow /></Link>
                </div>
                <div className="spotlight__preview">
                  {top.coverImage
                    ? <div className="frame"><img className="frame__img" src={top.coverImage} alt={`${top.name} preview`} loading="lazy" /></div>
                    : isBuilder(top)
                      ? <LivePreview slug={top.slug} name={top.name} url={builderPreviewUrl(top.slug)} />
                      : <LivePreview slug={top.slug} name={top.name} />}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* WHY BUILD WITH KURUMERA */}
      <section className="section">
        <div className="wrap">
          <div className="section__head"><div><span className="eyebrow">Why Kurumera</span><h2 className="section__title">Everything you need to launch fast</h2></div></div>
          <div className="why-grid">
            {WHY.map(({ icon: Icon, title, body }) => (
              <div key={title} className="why-grid__item">
                <span><Icon /></span>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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

      {/* BECOME A CREATOR */}
      <section className="section">
        <div className="wrap">
          <div className="creator-cta">
            <div>
              <h2>Create once. Earn on every install.</h2>
              <p className="creator-cta__sub">Publish a template through the creator dashboard — you set the price, you keep ownership, and it's listed for the whole marketplace to find.</p>
              <div className="creator-cta__feats">
                <div><span><Layers /></span>Upload your templates</div>
                <div><span><Search /></span>Get discovered</div>
                <div><span><Bolt /></span>Set your own price</div>
              </div>
            </div>
            <div className="creator-cta__aside">
              <div className="creator-cta__stat">{allCreatorsCount}</div>
              <div className="creator-cta__statlabel">creator{allCreatorsCount === 1 ? "" : "s"} already publishing</div>
              <Link className="btn btn--primary btn--lg" href="/creator">Become a creator <Arrow /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="wrap">
          <div className="section__head" style={{ justifyContent: "center", textAlign: "center" }}>
            <div style={{ margin: "0 auto" }}><span className="eyebrow">FAQ</span><h2 className="section__title">Frequently asked questions</h2></div>
          </div>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q} className="fgroup">
                <summary>{f.q}</summary>
                <div className="fgroup__body"><p>{f.a}</p></div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="section">
        <div className="wrap">
          <div className="closing-cta">
            <div>
              <h2>Ready to launch your site?</h2>
              <p>Browse the full collection of free and premium templates.</p>
            </div>
            <Link className="btn btn--primary btn--lg" href="/templates">Explore templates <Arrow /></Link>
          </div>
        </div>
      </section>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getTemplate, fetchTemplates, priceLabel, isFree, isBuilder, featureLabels, categoryLabel, authorLabel } from "@/lib/registry";
import { DetailPreview } from "@/components/DetailPreview";
import { BuilderPreview } from "@/components/BuilderPreview";
import { GetTemplate } from "@/components/GetTemplate";
import { GetBuilderTemplate } from "@/components/GetBuilderTemplate";
import { DetailTabs } from "@/components/DetailTabs";
import { Reviews } from "@/components/Reviews";
import { CountView } from "@/components/CountView";
import { SaveButton } from "@/components/SaveButton";
import { TemplateCard } from "@/components/TemplateCard";
import { Reveal, RevealGroup } from "@/components/motion/Reveal";
import "../../detail.css";

/**
 * TEMPLATE DETAIL — the conversion surface.
 *
 * Server Component, deliberately: it exports generateMetadata and calls
 * notFound(). Every interactive part (device switcher, acquire flows, tabs,
 * save) is an existing leaf client component, and the four acquire flows in
 * GetTemplate / GetBuilderTemplate are untouched.
 *
 * The composition change from the previous version: the name used to sit at
 * 28px inside a 372px sidebar, so the page opened on a form with a picture
 * beside it. The name is now a full-width masthead, and the sidebar keeps one
 * job — price, acquire, facts — which is why it can afford to be sticky.
 *
 * There is no cover image to hero here (nothing in the registry ships one), so
 * the live preview gets the height a hero image would have got. It is the only
 * true representation of the product on the page.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTemplate(slug);
  if (!t) return { title: "Template — Kurumera" };
  // Only the creator's own first paragraph — never a generated summary.
  const desc = t.description.split(/\n{2,}/)[0]?.trim();
  return {
    title: `${t.name} — Kurumera template`,
    ...(desc ? { description: desc.slice(0, 200) } : {}),
  };
}

export default async function TemplateDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTemplate(slug);
  if (!t) notFound();

  const all = await fetchTemplates();
  const related = all
    .filter((x) => x.slug !== t.slug && (x.category === t.category || x.author === t.author))
    .slice(0, 4);
  const feats = featureLabels(t, 6);
  const builder = isBuilder(t);
  const versionCount = t.versions.length || 1;

  return (
    <div className="dp">
      {/* ── MASTHEAD ─────────────────────────────────────────────────────────
          Three beats, staggered by the shared observer: the category orients,
          the name arrives on a mask wipe (the one expressive moment on the
          page — it is the page's subject), the metadata line settles under it.
          Nothing here moves again. */}
      <header className="wrap dp-head">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span>/</span>
          <Link href="/templates">Templates</Link><span>/</span>
          <span>{t.name}</span>
        </nav>

        <RevealGroup>
          {t.category && (
            <Reveal as="span" variant="fade" className="eyebrow dp-head__eyebrow">
              {categoryLabel(t.category)}
            </Reveal>
          )}
          <Reveal as="h1" variant="mask" className="dp-title">{t.name}</Reveal>
          <Reveal variant="fade" className="dp-meta">
            <span>by <span className="dp-meta__by">{authorLabel(t.author)}</span></span>
            <span className="dp-meta__sep" aria-hidden="true">/</span>
            <span>v{t.latest}</span>
            <span className="dp-meta__sep" aria-hidden="true">/</span>
            <span>{builder ? "Visual builder template" : "Next.js code theme"}</span>
          </Reveal>
        </RevealGroup>
      </header>

      <div className="wrap dp-grid">
        {/* The preview fades rather than rises or scales: it is a live
            cross-origin iframe, and translating or scaling the frame it sits in
            makes a real, rendering site look like a smeared screenshot. Fade is
            the honest arrival for something that is already the product. */}
        <Reveal variant="fade" className="dp-preview">
          {builder
            ? <BuilderPreview slug={t.slug} name={t.name} />
            : <DetailPreview slug={t.slug} name={t.name} />}
          <p className="dp-stage-note">
            This is the template running live, not a screenshot — resize it with the device
            buttons, or open it full screen.
          </p>
        </Reveal>

        {/* ── PURCHASE RAIL ─────────────────────────────────────────────────
            Sticky on desktop so the price and the button stay reachable for
            the whole length of the preview — the one place on this page where
            a persistent element is worth the screen it occupies. */}
        <Reveal as="aside" variant="fade" className="dp-rail" aria-label="Get this template">
          <div className="dp-buy">
            <div className="dp-price">
              <b className={isFree(t) ? "free" : ""}>{priceLabel(t)}</b>
              {!isFree(t) && <span>one-time · {t.currency}</span>}
            </div>

            {builder
              ? <GetBuilderTemplate slug={t.slug} name={t.name} free={isFree(t)} priceLabel={priceLabel(t)} />
              : <GetTemplate slug={t.slug} free={isFree(t)} priceLabel={priceLabel(t)} />}

            <div className="dp-save">
              <SaveButton slug={t.slug} className="btn btn--tertiary" label />
            </div>

            <dl className="dp-facts">
              <div className="dp-fact"><dt>Installs</dt><dd>{t.installs.toLocaleString()}</dd></div>
              <div className="dp-fact"><dt>Released versions</dt><dd>{versionCount}</dd></div>
              <div className="dp-fact">
                <dt>Works with</dt>
                <dd>{builder ? "Kurumera builder" : "Builder + code"}</dd>
              </div>
            </dl>
          </div>

          {feats.length > 0 && (
            <div className="dp-tags">
              {feats.map((x) => <span key={x} className="badge badge--soft">{x}</span>)}
            </div>
          )}
        </Reveal>
      </div>

      <section className="dp-info">
        <div className="wrap">
          <DetailTabs t={t} />
          <Reviews slug={t.slug} initial={t.rating} />
          <CountView slug={t.slug} />
        </div>
      </section>

      {related.length > 0 && (
        <section className="dp-related">
          <div className="wrap">
            <div className="section__head">
              <div>
                <Reveal as="span" variant="fade" className="eyebrow">You might also like</Reveal>
                <Reveal as="h2" variant="mask" className="section__title">Related templates</Reveal>
              </div>
            </div>
            {/* Staggered so the row reads left-to-right as a sequence of
                options rather than appearing as one block — discovery. */}
            <RevealGroup className="tpl-grid tpl-grid--4">
              {related.map((r) => (
                <Reveal key={r.slug} className="dp-rel-item">
                  <TemplateCard t={r} />
                </Reveal>
              ))}
            </RevealGroup>
          </div>
        </section>
      )}
    </div>
  );
}

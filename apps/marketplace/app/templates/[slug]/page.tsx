import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getTemplate, fetchTemplates, priceLabel, isFree, isBuilder, featureLabels, categoryLabel,
} from "@/lib/registry";
import { DetailPreview } from "@/components/DetailPreview";
import { BuilderPreview } from "@/components/BuilderPreview";
import { GetTemplate } from "@/components/GetTemplate";
import { GetBuilderTemplate } from "@/components/GetBuilderTemplate";
import { DetailTabs } from "@/components/DetailTabs";
import { SaveButton } from "@/components/SaveButton";
import { TemplateCard } from "@/components/TemplateCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getTemplate(slug);
  return { title: t ? `${t.name} — Kurumera template` : "Template — Kurumera" };
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

  return (
    <>
      <div className="wrap">
        <nav className="crumbs" style={{ paddingTop: 20 }} aria-label="Breadcrumb">
          <Link href="/">Home</Link><span>/</span><Link href="/templates">Templates</Link><span>/</span><span>{t.name}</span>
        </nav>
      </div>

      <div className="wrap pdp">
        {isBuilder(t)
          ? <BuilderPreview name={t.name} coverImage={t.coverImage} coverColor={t.coverColor} />
          : <DetailPreview slug={t.slug} name={t.name} />}

        <aside className="pdp__rail">
          {t.category && <span className="pdp__cat">{categoryLabel(t.category)}</span>}
          <h1 className="pdp__name">{t.name}</h1>
          <div className="pdp__author">by {t.author}</div>
          {t.description && <p className="note" style={{ marginTop: 12 }}>{t.description}</p>}

          <div className="pdp__price">
            <b className={isFree(t) ? "free" : ""}>{priceLabel(t)}</b>
            {!isFree(t) && <span className="note">one-time · {t.currency}</span>}
          </div>

          {isBuilder(t)
            ? <GetBuilderTemplate />
            : <GetTemplate slug={t.slug} free={isFree(t)} priceLabel={priceLabel(t)} />}
          <div style={{ marginTop: 10 }}>
            <SaveButton slug={t.slug} className="btn btn--tertiary" label />
          </div>

          <div className="pdp__facts">
            <div className="pdp__fact"><span>Installs</span><b>{t.installs.toLocaleString()}</b></div>
            {isBuilder(t) ? (
              <div className="pdp__fact"><span>Type</span><b>Visual builder template</b></div>
            ) : (
              <>
                <div className="pdp__fact"><span>Current version</span><b>v{t.latest}</b></div>
                <div className="pdp__fact"><span>Available versions</span><b>{t.versions.length || 1}</b></div>
                <div className="pdp__fact"><span>Compatibility</span><b>Visual builder + code</b></div>
              </>
            )}
          </div>

          {feats.length > 0 && (
            <div className="pdp__tags">{feats.map((x) => <span key={x} className="badge badge--soft">{x}</span>)}</div>
          )}
        </aside>
      </div>

      <div className="wrap">
        <DetailTabs t={t} />
      </div>

      {related.length > 0 && (
        <section className="section pdp-related">
          <div className="wrap">
            <div className="section__head"><div><span className="eyebrow">You might also like</span><h2 className="section__title">Related templates</h2></div></div>
            <div className="tpl-grid tpl-grid--4">{related.map((r) => <TemplateCard key={r.slug} t={r} />)}</div>
          </div>
        </section>
      )}
    </>
  );
}

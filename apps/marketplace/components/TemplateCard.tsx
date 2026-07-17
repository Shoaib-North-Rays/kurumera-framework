import Link from "next/link";
import { LivePreview } from "@/components/LivePreview";
import { SaveButton } from "@/components/SaveButton";
import { Download } from "@/components/Icons";
import { badges, featureLabels, priceLabel, isFree, categoryLabel, previewUrl, type Template } from "@/lib/registry";

export function TemplateCard({ t }: { t: Template }) {
  const href = `/templates/${t.slug}`;
  const bs = badges(t);
  const feats = featureLabels(t, 3);
  const cat = t.category ? categoryLabel(t.category) : "";

  return (
    <div className="tpl-card">
      <div className="tpl-card__media">
        {bs.length > 0 && (
          <div className="tpl-card__badges">
            {bs.map((b) => <span key={b.label} className={`badge badge--${b.kind}`}>{b.label}</span>)}
          </div>
        )}
        <SaveButton slug={t.slug} />
        {t.coverImage
          ? <div className="frame"><img className="frame__img" src={t.coverImage} alt={`${t.name} preview`} loading="lazy" /></div>
          : <LivePreview slug={t.slug} name={t.name} />}
        <div className="tpl-card__hover">
          <a href={previewUrl(t.slug)} target="_blank" rel="noreferrer" className="tpl-card__preview">Live Preview</a>
          <Link href={href} className="tpl-card__preview" style={{ marginLeft: 8 }}>View Details</Link>
        </div>
      </div>
      <Link href={href} className="tpl-card__body">
        {cat && <span className="tpl-card__creator" style={{ color: "var(--green-dark)", fontWeight: 600 }}>{cat}</span>}
        <h3 className="tpl-card__name">{t.name}</h3>
        <span className="tpl-card__creator">by {t.author}</span>
        {feats.length > 0 && <span className="tpl-card__creator">{feats.join(" · ")}</span>}
        <div className="tpl-card__foot">
          <span className="tpl-card__meta"><Download /> {t.installs.toLocaleString()} installs</span>
          <span className={`tpl-card__price ${isFree(t) ? "free" : ""}`}>{priceLabel(t)}</span>
        </div>
      </Link>
    </div>
  );
}

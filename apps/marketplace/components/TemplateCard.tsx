import Link from "next/link";
import { LivePreview } from "@/components/LivePreview";
import { SaveButton } from "@/components/SaveButton";
import { Arrow, Download } from "@/components/Icons";
import { badges, featureLabels, priceLabel, isFree, isBuilder, categoryLabel, livePreviewUrl, builderPreviewUrl, type Template, authorLabel } from "@/lib/registry";

/** Column span on the discovery grid's 12 tracks. Absent = the card renders
 *  exactly as it always has (home page, related rail). */
export type CardSpan = 3 | 4 | 6 | 12;

export function TemplateCard({ t, span, reveal }: { t: Template; span?: CardSpan; reveal?: boolean }) {
  const href = `/templates/${t.slug}`;
  const bs = badges(t);
  const feats = featureLabels(t, 3);
  const cat = t.category ? categoryLabel(t.category) : "";
  // Promoted cards get the room for a sentence — but only if there is one.
  // Three of the seven published templates have an empty description, and a
  // card that reserves space for absent copy is how a grid starts looking broken.
  const promoted = span != null && span >= 6;
  const blurb = promoted && t.description ? t.description : "";

  return (
    <article className="tpl-card" data-span={span} data-reveal={reveal ? "" : undefined}>
      <div className="tpl-card__media">
        {bs.length > 0 && (
          <div className="tpl-card__badges">
            {bs.map((b) => <span key={b.label} className={`badge badge--${b.kind}`}>{b.label}</span>)}
          </div>
        )}
        <SaveButton slug={t.slug} />
        {t.coverImage
          ? <div className="frame"><img className="frame__img" src={t.coverImage} alt={`${t.name} preview`} loading="lazy" /></div>
          : isBuilder(t)
            ? <LivePreview slug={t.slug} name={t.name} url={builderPreviewUrl(t.slug)} />
            : <LivePreview slug={t.slug} name={t.name} />}
        <div className="tpl-card__hover">
          <a href={livePreviewUrl(t)} target="_blank" rel="noreferrer" className="tpl-card__preview">Live Preview</a>
          <Link href={href} className="tpl-card__preview" style={{ marginLeft: 8 }}>View Details</Link>
        </div>
      </div>
      {/* The one real link. On the discovery surfaces app/discovery.css stretches
          it over the whole card, so the card IS the link rather than merely
          containing one — no nested anchors, and the overlay actions stay live. */}
      <Link href={href} className="tpl-card__body">
        {cat && <span className="tpl-card__creator" style={{ color: "var(--green-dark)", fontWeight: 600 }}>{cat}</span>}
        {promoted ? (
          <div className="tpl-card__title">
            <h3 className="tpl-card__name">{t.name}</h3>
            <span className="tpl-card__go mi-arrow" aria-hidden="true"><Arrow /></span>
          </div>
        ) : (
          <h3 className="tpl-card__name">{t.name}</h3>
        )}
        <span className="tpl-card__creator">by {authorLabel(t.author)}</span>
        {blurb && <span className="tpl-card__desc">{blurb}</span>}
        {feats.length > 0 && <span className="tpl-card__creator">{feats.join(" · ")}</span>}
        <div className="tpl-card__foot">
          {/* Total installs across the whole marketplace is 3. "0 installs" is a
              worse signal than no signal, so the line appears only when real. */}
          {t.installs > 0 && (
            <span className="tpl-card__meta"><Download /> {t.installs.toLocaleString()} {t.installs === 1 ? "install" : "installs"}</span>
          )}
          <span className={`tpl-card__price ${isFree(t) ? "free" : ""}`} style={{ marginLeft: "auto" }}>{priceLabel(t)}</span>
        </div>
      </Link>
    </article>
  );
}

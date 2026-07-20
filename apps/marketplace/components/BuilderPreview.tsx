/**
 * PDP preview for a builder template — a visual design has no code-theme
 * ?market=<slug> render, so we show its cover screenshot (or a themed
 * placeholder until the screenshot is captured) in the same .pdp__left slot.
 */
export function BuilderPreview({ name, coverImage }: { name: string; coverImage: string }) {
  return (
    <div className="pdp__left">
      <div className="builder-preview">
        {coverImage
          ? <img className="frame__img" src={coverImage} alt={`${name} preview`} />
          : <span className="frame__ph" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}
      </div>
    </div>
  );
}

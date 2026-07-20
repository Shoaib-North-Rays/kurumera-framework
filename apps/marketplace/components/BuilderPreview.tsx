import { BuilderThumb } from "@/components/BuilderThumb";

/**
 * PDP preview for a builder template — a visual design has no code-theme
 * ?market=<slug> render, so we show its cover screenshot (or a branded,
 * theme-coloured cover until the screenshot is captured) in the .pdp__left slot.
 */
export function BuilderPreview({ name, coverImage, coverColor }: { name: string; coverImage: string; coverColor: string }) {
  return (
    <div className="pdp__left">
      <div className="builder-preview">
        {coverImage
          ? <img className="frame__img" src={coverImage} alt={`${name} preview`} />
          : <BuilderThumb name={name} color={coverColor} />}
      </div>
    </div>
  );
}

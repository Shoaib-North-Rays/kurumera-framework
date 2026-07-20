/**
 * Branded cover for a builder listing that has no rendered screenshot yet — a
 * gradient from the design's own primary colour with the design name, so it reads
 * as an intentional, on-brand card rather than a generic placeholder.
 */
export function BuilderThumb({ name, color }: { name: string; color?: string }) {
  const c = color && /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : "#4338CA";
  return (
    <div className="builder-thumb" style={{ background: `linear-gradient(155deg, ${c}, #0b1220)` }}>
      <span>{name}</span>
    </div>
  );
}

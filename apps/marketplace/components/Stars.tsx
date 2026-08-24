import type { Rating } from "@/lib/registry";

/**
 * The star row.
 *
 * THE RULE THIS COMPONENT ENFORCES: no reviews renders as NOTHING, not as five
 * empty outlines and not as "0.0". An unrated template and a badly-rated one
 * must not look alike, and a row of grey stars says "rated poorly" to every
 * shopper who glances at it. Most of the catalogue is unrated today, so this is
 * the common case, not the edge case.
 *
 * Fractional fill is a clip on an overlay, not a rounded count — 4.5 shows as
 * four and a half, because rounding 4.5 to 5 is the small dishonesty that makes
 * people stop trusting the whole row.
 */
export function Stars({
  rating,
  size = 14,
  showCount = true,
  className = "",
}: {
  rating: Rating;
  size?: number;
  /** Off for dense grids where the number would crowd the tile. */
  showCount?: boolean;
  className?: string;
}) {
  if (!rating || rating.count === 0) return null;

  const pct = Math.max(0, Math.min(100, (rating.average / 5) * 100));
  const label = `${rating.average} out of 5, from ${rating.count} verified ${rating.count === 1 ? "owner" : "owners"}`;

  return (
    <span className={`stars ${className}`.trim()} title={label}>
      <span className="stars__glyphs" style={{ ["--star-size" as string]: `${size}px` }} aria-hidden>
        <span className="stars__base">{"★★★★★"}</span>
        <span className="stars__fill" style={{ width: `${pct}%` }}>{"★★★★★"}</span>
      </span>
      <span className="stars__value" aria-hidden>{rating.average.toFixed(1)}</span>
      {showCount && (
        <span className="stars__count" aria-hidden>
          ({rating.count})
        </span>
      )}
      {/* The whole thing is decorative to a screen reader except this line,
          which states the figure and where it comes from in one go. */}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * The 5→1 histogram, for a detail page. Only worth showing once there are
 * enough ratings for a shape to mean anything — with two reviews a bar chart
 * implies a distribution the data does not have.
 */
export const HISTOGRAM_MIN = 5;

export function RatingBars({ rating }: { rating: Rating }) {
  if (!rating || rating.count < HISTOGRAM_MIN) return null;
  const max = Math.max(...rating.distribution, 1);
  return (
    <ul className="rbars">
      {[5, 4, 3, 2, 1].map((n) => {
        const v = rating.distribution[n - 1] || 0;
        return (
          <li key={n}>
            <span className="rbars__n">{n}</span>
            <span className="rbars__track">
              <span className="rbars__fill" style={{ width: `${(v / max) * 100}%` }} />
            </span>
            <span className="rbars__v">{v}</span>
          </li>
        );
      })}
    </ul>
  );
}

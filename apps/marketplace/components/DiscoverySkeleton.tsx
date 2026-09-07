/**
 * Skeleton for the discovery routes (/templates, /free, /paid, /category/*).
 *
 * This used to be `app/templates/loading.tsx`. It was moved because a
 * route-level `loading.tsx` creates a Suspense boundary around the WHOLE
 * segment — Next streams the fallback immediately, which commits the response
 * at HTTP 200, and any `notFound()` the page reaches afterwards can no longer
 * change the status. That turned every unknown category into a soft 404: the
 * branded "Page not found" body, served as success.
 *
 * Rendered from inside the page instead, wrapping only the part that actually
 * fetches, so the page's own checks run and settle the status before anything
 * is flushed. Same skeleton, same moment, correct status.
 *
 * The grid geometry is fixed and uniform (every card is a quarter, 64:45
 * media), so this occupies exactly the space the real results will and nothing
 * shifts when they arrive.
 */
export function DiscoverySkeleton() {
  return (
    <div className="wrap" style={{ paddingTop: 24, paddingBottom: "var(--sec-md)" }} aria-hidden>
      <div className="sk sk--line" style={{ width: "18rem", height: "2.75rem" }} />
      <div className="sk sk--line" style={{ width: "26rem", height: "1.1rem", marginTop: "var(--s-4)" }} />

      <div className="disc-grid" style={{ marginTop: "var(--s-9)" }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} data-span="3">
            <div className="sk" style={{ aspectRatio: "64 / 45", borderRadius: "var(--r-md)" }} />
            <div className="sk sk--line" style={{ width: "35%", height: ".7rem", marginTop: "var(--s-4)" }} />
            <div className="sk sk--line" style={{ width: "70%", height: "1.15rem", marginTop: ".5rem" }} />
            <div className="sk sk--line" style={{ width: "45%", height: ".8rem", marginTop: ".45rem" }} />
          </div>
        ))}
      </div>

      {/* Announced once, politely — a screen reader should hear that something
          is coming, not read out a wall of empty boxes. */}
      <p role="status" className="visually-hidden">Loading templates…</p>
    </div>
  );
}

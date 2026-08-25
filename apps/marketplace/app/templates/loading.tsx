/**
 * Skeleton for the discovery routes (/templates, /free, /paid, /category/*).
 *
 * All of them are `force-dynamic` and block on a network fetch to the registry
 * before a single byte of HTML is streamed, and there was no loading.tsx
 * anywhere in the app. On a hard navigation that meant a white page for the
 * duration of the upstream call; on a client-side navigation it was worse — the
 * previous page simply froze, giving no sign that the click had registered.
 *
 * The grid geometry is fixed and uniform (every card is a quarter, 64:45 media),
 * so this occupies exactly the space the real results will, and nothing shifts
 * when they arrive.
 */
export default function Loading() {
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

/**
 * Skeleton for a template detail page.
 *
 * Same reasoning as the discovery skeleton: the route is `force-dynamic` and
 * blocks on the registry, and a click from a card used to leave the previous
 * page frozen with no feedback. This is the page a buyer arrives on from a
 * shared link, so it is the one where a white pause reads worst.
 */
export default function Loading() {
  return (
    <div className="wrap" style={{ paddingTop: 24, paddingBottom: "var(--sec-md)" }} aria-hidden>
      <div className="sk sk--line" style={{ width: "16rem", height: ".8rem" }} />
      <div className="sk sk--line" style={{ width: "22rem", height: "2.5rem", marginTop: "var(--s-5)" }} />
      <div className="sk sk--line" style={{ width: "12rem", height: "1rem", marginTop: "var(--s-3)" }} />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 20rem)", gap: "var(--s-8)", marginTop: "var(--s-7)" }}>
        <div className="sk" style={{ aspectRatio: "64 / 45", borderRadius: "var(--r-md)" }} />
        <div>
          <div className="sk" style={{ height: "3rem", borderRadius: "var(--r-md)" }} />
          <div className="sk" style={{ height: "3rem", borderRadius: "var(--r-md)", marginTop: "var(--s-3)" }} />
          <div className="sk sk--line" style={{ height: ".9rem", marginTop: "var(--s-6)" }} />
          <div className="sk sk--line" style={{ height: ".9rem", marginTop: ".5rem", width: "80%" }} />
        </div>
      </div>

      <p role="status" className="visually-hidden">Loading template…</p>
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";

/**
 * The 404 page.
 *
 * There was no `not-found.tsx` at all, so every miss fell through to Next's
 * built-in screen — "404 | This page could not be found", inline-styled and
 * unbranded — rendered inside our own header and footer. The most likely URL
 * anyone mistypes or shares stale is `/templates/<slug>`, which is exactly the
 * page `notFound()` is called from, so this is the 404 a real customer sees.
 *
 * It offers a way out rather than a dead end: search, the catalogue, and the
 * free listing, because someone who landed on a missing template is still
 * someone looking for a template.
 */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="wrap" style={{ padding: "clamp(4rem, 12vw, 9rem) 0", textAlign: "center" }}>
      <p style={{ fontSize: "var(--t-meta)", fontWeight: 700, letterSpacing: "var(--ls-label)", textTransform: "uppercase", color: "var(--green-dark)" }}>
        404
      </p>
      <h1 style={{ marginTop: "var(--s-4)", fontSize: "var(--t-h1)", lineHeight: "var(--lh-heading)", letterSpacing: "var(--ls-heading)", fontWeight: 800 }}>
        We couldn&rsquo;t find that page.
      </h1>
      <p style={{ margin: "var(--s-5) auto 0", maxWidth: "46ch", color: "var(--muted)", lineHeight: "var(--lh-body)" }}>
        The template may have been unpublished by its creator, or the link may be
        out of date. Everything else is still here.
      </p>

      <form action="/templates" role="search" style={{ margin: "var(--s-7) auto 0", maxWidth: "28rem" }}>
        <input className="input" type="search" name="q" placeholder="Search templates…" aria-label="Search templates" />
      </form>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)", justifyContent: "center", marginTop: "var(--s-6)" }}>
        <Link className="btn btn--primary" href="/templates">Browse all templates</Link>
        <Link className="btn btn--secondary" href="/templates/free">See the free ones</Link>
      </div>
    </div>
  );
}

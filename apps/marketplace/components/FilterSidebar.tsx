import Link from "next/link";
import { CATEGORIES, STYLES, type Template } from "@/lib/registry";
import { buildHref, spGet, type SP } from "@/lib/params";

/** Server-rendered, URL-driven filters. Each option is a link → shareable state.
 *  Only filters with real backing data (category, price, style tags, author). */
export function FilterSidebar({ templates, params, counts }: { templates: Template[]; params: SP; counts: Record<string, number> }) {
  const activeCat = spGet(params, "category");
  const activePrice = spGet(params, "price");
  const activeStyle = spGet(params, "style");
  const activeAuthor = spGet(params, "author");

  // Only surface styles + authors that actually exist in the data.
  const styleTags = STYLES.filter((s) => templates.some((t) => t.tags.includes(s)));
  const authors = Array.from(new Set(templates.map((t) => t.author))).sort();
  const freeCount = templates.filter((t) => !t.price).length;
  const paidCount = templates.length - freeCount;

  const opt = (active: boolean, href: string, label: string, n?: number) => (
    <Link key={label + href} href={href} className={`fopt ${active ? "active" : ""}`}>
      <span>{label}</span>{n != null && <span className="n">{n}</span>}
    </Link>
  );

  return (
    <>
      <details className="fgroup" open>
        <summary>Category</summary>
        <div className="fgroup__body">
          {opt(!activeCat, buildHref("/templates", params, { category: undefined }), "All categories", templates.length)}
          {CATEGORIES.filter((c) => (counts[c.key] || 0) > 0).map((c) =>
            opt(activeCat === c.key, buildHref("/templates", params, { category: c.key }), c.label, counts[c.key]))}
        </div>
      </details>

      <details className="fgroup" open>
        <summary>Price</summary>
        <div className="fgroup__body">
          {opt(!activePrice, buildHref("/templates", params, { price: undefined }), "All", templates.length)}
          {opt(activePrice === "free", buildHref("/templates", params, { price: "free" }), "Free", freeCount)}
          {opt(activePrice === "paid", buildHref("/templates", params, { price: "paid" }), "Paid", paidCount)}
        </div>
      </details>

      {styleTags.length > 0 && (
        <details className="fgroup" open>
          <summary>Style</summary>
          <div className="fgroup__body">
            {opt(!activeStyle, buildHref("/templates", params, { style: undefined }), "Any style")}
            {styleTags.map((s) =>
              opt(activeStyle === s, buildHref("/templates", params, { style: s }), s[0].toUpperCase() + s.slice(1)))}
          </div>
        </details>
      )}

      {authors.length > 1 && (
        <details className="fgroup">
          <summary>Creator</summary>
          <div className="fgroup__body">
            {opt(!activeAuthor, buildHref("/templates", params, { author: undefined }), "All creators")}
            {authors.map((a) =>
              opt(activeAuthor === a, buildHref("/templates", params, { author: a }), a))}
          </div>
        </details>
      )}
    </>
  );
}

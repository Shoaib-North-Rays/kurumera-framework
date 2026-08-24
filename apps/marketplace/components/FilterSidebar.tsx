import Link from "next/link";
import { CATEGORIES, STYLES, type Template, authorLabel } from "@/lib/registry";
import { spGet, type SP } from "@/lib/params";
import { Check } from "@/components/Icons";

/**
 * How a filter option turns into an href.
 *
 * The sidebar used to build these itself against a hardcoded "/templates"
 * base, which meant every option on /templates/category/restaurant silently
 * navigated OUT of the category. It no longer knows the route at all —
 * DiscoveryView owns that decision and passes the resolver down, because only
 * the view knows which filters the current route pins in place.
 */
export type FilterHref = (updates: Record<string, string | undefined>) => string;

/** Server-rendered, URL-driven filters. Each option is a link → shareable state.
 *  Only filters with real backing data (category, price, style tags, author).
 *
 *  Rendered ONCE. The desktop column and the mobile sheet are the same element
 *  presented two ways (see app/discovery.css) rather than two copies of this
 *  tree, which previously doubled every option in the DOM — and with it the
 *  duplicate ids, the duplicate tab stops and the duplicate `details` state. */
export function FilterSidebar({
  templates,
  params,
  counts,
  href,
}: {
  templates: Template[];
  params: SP;
  counts: Record<string, number>;
  href: FilterHref;
}) {
  const activeCat = spGet(params, "category");
  const activePrice = spGet(params, "price");
  const activeStyle = spGet(params, "style");
  const activeAuthor = spGet(params, "author");

  // Only surface styles + authors that actually exist in the data.
  const styleTags = STYLES.filter((s) => templates.some((t) => t.tags.includes(s)));
  const authors = Array.from(new Set(templates.map((t) => t.author))).sort();
  const freeCount = templates.filter((t) => !t.price).length;
  const paidCount = templates.length - freeCount;

  const opt = (active: boolean, to: string, label: string, n?: number) => (
    <Link key={label + to} href={to} className={`fopt ${active ? "active" : ""}`} aria-current={active || undefined}>
      <span className="fopt__box">{active && <Check />}</span>
      <span className="fopt__label">{label}</span>
      {n != null && <span className="n">{n}</span>}
    </Link>
  );

  return (
    <>
      <details className="fgroup" open>
        <summary>Category</summary>
        <div className="fgroup__body">
          {opt(!activeCat, href({ category: undefined }), "All categories", templates.length)}
          {CATEGORIES.filter((c) => (counts[c.key] || 0) > 0).map((c) =>
            opt(activeCat === c.key, href({ category: c.key }), c.label, counts[c.key]))}
        </div>
      </details>

      <details className="fgroup" open>
        <summary>Price</summary>
        <div className="fgroup__body">
          {opt(!activePrice, href({ price: undefined }), "All", templates.length)}
          {opt(activePrice === "free", href({ price: "free" }), "Free", freeCount)}
          {opt(activePrice === "paid", href({ price: "paid" }), "Paid", paidCount)}
        </div>
      </details>

      {styleTags.length > 0 && (
        <details className="fgroup" open>
          <summary>Style</summary>
          <div className="fgroup__body">
            {opt(!activeStyle, href({ style: undefined }), "Any style")}
            {styleTags.map((s) =>
              opt(activeStyle === s, href({ style: s }), s[0].toUpperCase() + s.slice(1)))}
          </div>
        </details>
      )}

      {authors.length > 1 && (
        <details className="fgroup">
          <summary>Creator</summary>
          <div className="fgroup__body">
            {opt(!activeAuthor, href({ author: undefined }), "All creators")}
            {/* The LABEL is masked, the filter VALUE is not — the href has to
                carry the real author string for the filter to match, but the
                visible text must not publish a working email address. */}
            {authors.map((a) =>
              opt(activeAuthor === a, href({ author: a }), authorLabel(a)))}
          </div>
        </details>
      )}
    </>
  );
}

import Link from "next/link";
import { fetchTemplates, applyFilters, categoryCounts, categoryLabel, type Filters } from "@/lib/registry";
import { FilterSidebar } from "@/components/FilterSidebar";
import { SortSelect } from "@/components/SortSelect";
import { TemplateCard } from "@/components/TemplateCard";
import { Search, Sliders, Grid, List, X, Chevron } from "@/components/Icons";
import { buildHref, spGet, type SP } from "@/lib/params";

function titleFor(f: Filters): string {
  if (f.q) return `Results for “${f.q}”`;
  if (f.category) return `${categoryLabel(f.category)} templates`;
  if (f.price === "free") return "Free templates";
  if (f.price === "paid") return "Premium templates";
  return "Templates for every idea";
}

/** Human label for each active filter, for the removable chips row. Only
 *  filters that actually have real backing data appear here — same rule
 *  FilterSidebar follows. */
function activeChips(f: Filters): { key: keyof Filters; label: string }[] {
  const chips: { key: keyof Filters; label: string }[] = [];
  if (f.category) chips.push({ key: "category", label: categoryLabel(f.category) });
  if (f.price) chips.push({ key: "price", label: f.price === "free" ? "Free" : "Paid" });
  if (f.style) chips.push({ key: "style", label: f.style[0].toUpperCase() + f.style.slice(1) });
  if (f.author) chips.push({ key: "author", label: f.author });
  if (f.q) chips.push({ key: "q", label: `“${f.q}”` });
  return chips;
}

/** Windowed page numbers with ellipsis gaps, e.g. 1 … 4 5 [6] 7 8 … 25. */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = new Set<number>([1, total, current, current - 1, current + 1]);
  const nums = [...out].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const withGaps: (number | "…")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - (nums[i - 1] as number) > 1) withGaps.push("…");
    withGaps.push(n);
  });
  return withGaps;
}

/** Shared discovery experience. `forced` presets a filter for the dedicated
 *  routes (/templates/free, /templates/category/[category]) while filter links
 *  still carry it forward via the URL. */
export async function DiscoveryView({ params, forced = {} }: { params: SP; forced?: Record<string, string> }) {
  const templates = await fetchTemplates();
  const counts = categoryCounts(templates);
  const effective: SP = { ...params, ...forced };
  const f: Filters = {
    category: spGet(effective, "category"),
    price: spGet(effective, "price") as Filters["price"],
    style: spGet(effective, "style"),
    tag: spGet(effective, "tag"),
    author: spGet(effective, "author"),
    q: spGet(effective, "q"),
    sort: spGet(effective, "sort"),
  };
  const view = spGet(effective, "view") === "list" ? "list" : "grid";
  const results = applyFilters(templates, f);

  // Paginate so a large registry never renders dozens of previews at once.
  const PAGE_SIZE = 12;
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, parseInt(spGet(effective, "page") || "1", 10) || 1), pages);
  const shown = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (n: number) => {
    const q = new URLSearchParams();
    (["category", "price", "style", "tag", "author", "q", "sort"] as const).forEach((k) => { if (f[k]) q.set(k, String(f[k])); });
    if (view === "list") q.set("view", "list");
    if (n > 1) q.set("page", String(n));
    const s = q.toString();
    return `/templates${s ? `?${s}` : ""}`;
  };

  const sidebar = <FilterSidebar templates={templates} params={effective} counts={counts} />;
  const chips = activeChips(f);

  return (
    <>
      <section className="disc-head">
        <div className="wrap disc-head__inner">
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span>Templates</span></nav>
          <div className="disc-head__row">
            <div>
              <h1>{titleFor(f)}</h1>
              <p>Kickstart your next project with professionally designed templates. Customizable, responsive, and ready to publish.</p>
            </div>
            <form className="disc-head__search searchbox" action="/templates" role="search">
              <Search />
              <input className="input" type="search" name="q" defaultValue={f.q || ""} placeholder="Search templates, industries, styles, or features…" aria-label="Search templates" />
              {f.category && <input type="hidden" name="category" value={f.category} />}
              {f.price && <input type="hidden" name="price" value={f.price} />}
              {f.style && <input type="hidden" name="style" value={f.style} />}
              {f.author && <input type="hidden" name="author" value={f.author} />}
              {f.sort && <input type="hidden" name="sort" value={f.sort} />}
              <button type="submit" aria-label="Search"><Search /></button>
            </form>
          </div>
        </div>
      </section>

      <div className="wrap disc">
        <aside aria-label="Filters">
          <details className="filters__mobile"><summary><Sliders width={18} height={18} /> Filters</summary><div className="filters__inner">{sidebar}</div></details>
          <div className="filters filters__desktop">{sidebar}</div>
        </aside>

        <div>
          {chips.length > 0 && (
            <div className="filter-chips">
              {chips.map((c) => (
                <Link key={c.key} className="filter-chip" href={buildHref("/templates", effective, { [c.key]: undefined })}>
                  {c.label} <X />
                </Link>
              ))}
              <Link className="filter-chips__clear" href="/templates">Clear all</Link>
            </div>
          )}

          <div className="disc-bar">
            <span className="count"><b>{results.length}</b> template{results.length === 1 ? "" : "s"}</span>
            <div className="disc-bar__actions">
              <div className="view-toggle" role="group" aria-label="Layout">
                <Link href={buildHref("/templates", effective, { view: undefined })} className={view === "grid" ? "active" : ""} aria-label="Grid view" aria-current={view === "grid"}><Grid /></Link>
                <Link href={buildHref("/templates", effective, { view: "list" })} className={view === "list" ? "active" : ""} aria-label="List view" aria-current={view === "list"}><List /></Link>
              </div>
              <SortSelect />
            </div>
          </div>

          {results.length ? (
            <>
              <div className={view === "list" ? "tpl-grid--list" : "tpl-grid tpl-grid--4"}>{shown.map((t) => <TemplateCard key={t.slug} t={t} />)}</div>
              {pages > 1 && (
                <nav className="pager--numbered" aria-label="Pagination">
                  <Link className={`pager__arrow ${page <= 1 ? "disabled" : ""}`} href={pageHref(page - 1)} aria-label="Previous page"><Chevron style={{ transform: "rotate(180deg)" }} /></Link>
                  {pageWindow(page, pages).map((n, i) =>
                    n === "…"
                      ? <span key={`e${i}`} className="pager__num ellipsis">…</span>
                      : <Link key={n} className={`pager__num ${n === page ? "active" : ""}`} href={pageHref(n)}>{n}</Link>
                  )}
                  <Link className={`pager__arrow ${page >= pages ? "disabled" : ""}`} href={pageHref(page + 1)} aria-label="Next page"><Chevron /></Link>
                </nav>
              )}
            </>
          ) : (
            <div className="empty">
              <h3>We couldn&rsquo;t find a template matching {f.q ? `“${f.q}”` : "those filters"}.</h3>
              <p>Try removing a filter, exploring a related category, or starting from a blank canvas.</p>
              <div className="empty__actions">
                <Link href="/templates" className="btn btn--secondary">Clear filters</Link>
                <Link href="/templates/free" className="btn btn--primary">Browse free templates</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

import Link from "next/link";
import { fetchTemplates, applyFilters, categoryCounts, categoryLabel, type Filters } from "@/lib/registry";
import { FilterSidebar } from "@/components/FilterSidebar";
import { SortSelect } from "@/components/SortSelect";
import { TemplateCard } from "@/components/TemplateCard";
import { Search, Sliders } from "@/components/Icons";
import { spGet, type SP } from "@/lib/params";

function titleFor(f: Filters): string {
  if (f.q) return `Results for “${f.q}”`;
  if (f.category) return `${categoryLabel(f.category)} templates`;
  if (f.price === "free") return "Free templates";
  if (f.price === "paid") return "Premium templates";
  return "All templates";
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
  const results = applyFilters(templates, f);

  // Paginate so a large registry never renders dozens of previews at once.
  const PAGE_SIZE = 12;
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, parseInt(spGet(effective, "page") || "1", 10) || 1), pages);
  const shown = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (n: number) => {
    const q = new URLSearchParams();
    (["category", "price", "style", "tag", "author", "q", "sort"] as const).forEach((k) => { if (f[k]) q.set(k, String(f[k])); });
    if (n > 1) q.set("page", String(n));
    const s = q.toString();
    return `/templates${s ? `?${s}` : ""}`;
  };

  const sidebar = <FilterSidebar templates={templates} params={effective} counts={counts} />;

  return (
    <>
      <section className="disc-head">
        <div className="wrap disc-head__inner">
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span>Templates</span></nav>
          <h1>{titleFor(f)}</h1>
          <p>Browse professionally designed templates you can customize and publish.</p>
        </div>
      </section>

      <div className="wrap disc">
        <aside aria-label="Filters">
          <details className="filters__mobile"><summary><Sliders width={18} height={18} /> Filters</summary><div className="filters__inner">{sidebar}</div></details>
          <div className="filters filters__desktop">{sidebar}</div>
        </aside>

        <div>
          <div className="disc-bar">
            <span className="count"><b>{results.length}</b> template{results.length === 1 ? "" : "s"}</span>
            <form className="disc-search" action="/templates" role="search">
              <Search />
              <input className="input" type="search" name="q" defaultValue={f.q || ""} placeholder="Search templates…" aria-label="Search templates" />
              {/* Carry active filters through a search so results stay scoped/shareable. */}
              {f.category && <input type="hidden" name="category" value={f.category} />}
              {f.price && <input type="hidden" name="price" value={f.price} />}
              {f.style && <input type="hidden" name="style" value={f.style} />}
              {f.tag && <input type="hidden" name="tag" value={f.tag} />}
              {f.author && <input type="hidden" name="author" value={f.author} />}
              {f.sort && <input type="hidden" name="sort" value={f.sort} />}
            </form>
            <SortSelect />
          </div>

          {results.length ? (
            <>
              <div className="tpl-grid tpl-grid--4">{shown.map((t) => <TemplateCard key={t.slug} t={t} />)}</div>
              {pages > 1 && (
                <nav className="pager" aria-label="Pagination">
                  {page > 1 ? <Link className="btn btn--secondary" href={pageHref(page - 1)}>← Previous</Link> : <span className="btn btn--secondary pager__disabled">← Previous</span>}
                  <span className="pager__info">Page {page} of {pages}</span>
                  {page < pages ? <Link className="btn btn--secondary" href={pageHref(page + 1)}>Next →</Link> : <span className="btn btn--secondary pager__disabled">Next →</span>}
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

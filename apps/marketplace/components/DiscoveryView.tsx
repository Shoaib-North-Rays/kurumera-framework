import Link from "next/link";
import { fetchTemplates, applyFilters, categoryCounts, categoryLabel, type Filters } from "@/lib/registry";
import { FilterSidebar, type FilterHref } from "@/components/FilterSidebar";
import { SortSelect } from "@/components/SortSelect";
import { TemplateCard, type CardSpan } from "@/components/TemplateCard";
import { DiscoveryReveals } from "@/components/DiscoveryReveals";
import { SearchForm } from "@/components/SearchForm";
import { Search, Sliders, Grid, List, X, Chevron } from "@/components/Icons";
import { buildHref, spGet, type SP } from "@/lib/params";
import "@/app/discovery.css";

/** Filters that can appear in a discovery URL. */
const FILTER_KEYS = ["category", "price", "style", "tag", "author", "q", "sort"] as const;

/** Dedicated routes that exist for a single price value. */
const PRICE_ROUTES: Record<string, string> = { free: "/templates/free", paid: "/templates/paid" };

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

/**
 * Where a filter change should land.
 *
 * THE BUG THIS REPLACES: every option, chip, pager link and view toggle was
 * built against a literal "/templates", so one click from
 * /templates/category/restaurant threw you out of the category route entirely.
 *
 * The rule is not simply "use the current route", because a route can PIN a
 * filter. Changing a pinned filter on its own route is unrepresentable — the
 * route would just override the click — so those links, and only those, have to
 * leave. They leave for the dedicated route of the NEW value when one exists,
 * so switching category lands on /templates/category/<next> rather than
 * degrading to a query string. Everything else stays where the user is.
 */
function makeHref(base: string, params: SP, effective: SP, forced: Record<string, string>): FilterHref {
  const forcedKeys = new Set(Object.keys(forced));
  return (updates) => {
    // Any filter change invalidates the page window: page 3 of the old result
    // set is not page 3 of the new one.
    const withReset = { ...updates, page: undefined };

    // Ordinary case — stay put. Built from `params` rather than the merged set,
    // so the route's own pinned filter is never duplicated into the query.
    if (!Object.keys(updates).some((k) => forcedKeys.has(k))) return buildHref(base, params, withReset);

    // Conflicting case — fold the pinned values into the query so nothing else
    // is lost, apply the change, then pick the best route for the result.
    const next: SP = { ...effective };
    delete next.page;
    for (const [k, v] of Object.entries(updates)) {
      if (v) next[k] = v;
      else delete next[k];
    }

    const cat = spGet(next, "category");
    if (forcedKeys.has("category") && cat) {
      const rest = { ...next };
      delete rest.category;
      return buildHref(`/templates/category/${encodeURIComponent(cat)}`, rest, {});
    }
    const price = spGet(next, "price");
    if (forcedKeys.has("price") && price && PRICE_ROUTES[price]) {
      const rest = { ...next };
      delete rest.price;
      return buildHref(PRICE_ROUTES[price], rest, {});
    }
    return buildHref("/templates", next, {});
  };
}

/**
 * Column spans for the results grid, on twelve tracks.
 *
 * The rhythm is a seven-card cycle — [6,3,3] then [3,3,3,3] — so each cycle
 * opens with a promoted card and every row closes flush. The tail is widened to
 * fill its final row, because a grid that ends on a hole reads as broken rather
 * than editorial, and with seven templates published the tail IS the page.
 *
 * Layout only. Nothing here promotes a card on invented merit: position in the
 * active sort order is the entire basis, so the top result is the large one.
 */
const CYCLE: CardSpan[] = [6, 3, 3, 3, 3, 3, 3];
const TAIL: Record<number, CardSpan[]> = {
  0: [],
  1: [12],
  2: [6, 6],
  3: [6, 3, 3],
  4: [6, 6, 6, 6],
  5: [6, 3, 3, 6, 6],
  6: [6, 3, 3, 4, 4, 4],
};
function rhythm(n: number): CardSpan[] {
  const out: CardSpan[] = [];
  while (n - out.length >= CYCLE.length) out.push(...CYCLE);
  return out.concat(TAIL[n - out.length]);
}

/** Shared discovery experience. `forced` presets a filter for the dedicated
 *  routes (/templates/free, /templates/category/[category]); `base` is that
 *  route's own path, and every link on the page is built from it. */
export async function DiscoveryView({
  params,
  forced = {},
  base = "/templates",
}: {
  params: SP;
  forced?: Record<string, string>;
  base?: string;
}) {
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

  const href = makeHref(base, params, effective, forced);
  // Paging and the view toggle can never contradict the route, so they always
  // stay on it — and unlike a filter change they must NOT reset the page.
  const pageHref = (n: number) => buildHref(base, params, { page: n > 1 ? String(n) : undefined });
  const viewHref = (v: "grid" | "list") => buildHref(base, params, { view: v === "list" ? "list" : undefined });

  const chips = activeChips(f);
  const forcedKeys = new Set(Object.keys(forced));
  const spans = rhythm(shown.length);
  // Only the filters this route does not already pin need carrying through the
  // search; the route itself supplies the rest.
  const carried: Record<string, string | undefined> = {};
  for (const k of FILTER_KEYS) if (k !== "q" && !forcedKeys.has(k)) carried[k] = f[k] as string | undefined;
  // Re-arms the shared reveal observer on exactly the navigations that swap
  // results, and on no others.
  const token = `${base}|${FILTER_KEYS.map((k) => f[k] ?? "").join("|")}|${view}|${page}`;

  return (
    <>
      <section className="disc-head">
        <div className="wrap disc-head__inner">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            {base === "/templates" ? (
              <span>Templates</span>
            ) : (
              <>
                <Link href="/templates">Templates</Link>
                <span>/</span>
                <span>{titleFor({ ...f, q: undefined })}</span>
              </>
            )}
          </nav>
          <div className="disc-head__row">
            <div>
              <h1>{titleFor(f)}</h1>
              <p>Kickstart your next project with professionally designed templates. Customizable, responsive, and ready to publish.</p>
            </div>
            {/* Router-driven (was a native GET, i.e. a full document reload on
                every search). Keyed on the active query so that arriving here
                from a different search — or clearing one — resets the field
                instead of leaving a stale term in an uncontrolled input.
                `action` is the CURRENT route, so a search from
                /templates/category/restaurant searches within the category. */}
            <SearchForm
              key={f.q || ""}
              className="disc-head__search searchbox"
              action={base}
              defaultValue={f.q || ""}
              placeholder="Search templates, industries, styles, or features…"
              hidden={carried}
            >
              <button type="submit" aria-label="Search"><Search /></button>
            </SearchForm>
          </div>
        </div>
      </section>

      <div className="wrap disc">
        {/* ONE sidebar. It used to be rendered twice — a desktop div and a
            mobile <details> — which duplicated every option, every tab stop and
            every disclosure state in the DOM. The single panel is now a sticky
            column on desktop and a :target bottom sheet below 880px, both from
            app/discovery.css: no JS, and the open state stays in the URL like
            everything else on this page. */}
        <aside className="disc-side" aria-label="Filters">
          <a className="disc-side__trigger" href="#filters">
            <Sliders width={18} height={18} /> Filters
            {chips.length > 0 && <span className="disc-side__n">{chips.length}</span>}
          </a>

          <div className="disc-side__panel" id="filters">
            <div className="disc-side__head">
              <span>Filters</span>
              <a className="disc-side__close" href="#disc-results" aria-label="Close filters"><X /></a>
            </div>
            <FilterSidebar templates={templates} params={effective} counts={counts} href={href} />
          </div>

          <a className="disc-side__scrim" href="#disc-results" tabIndex={-1} aria-hidden="true" />
        </aside>

        <div id="disc-results">
          {chips.length > 0 && (
            <div className="filter-chips">
              {chips.map((c) => (
                <Link key={c.key} className="filter-chip" href={href({ [c.key]: undefined })}>
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
                <Link href={viewHref("grid")} className={view === "grid" ? "active" : ""} aria-label="Grid view" aria-current={view === "grid"}><Grid /></Link>
                <Link href={viewHref("list")} className={view === "list" ? "active" : ""} aria-label="List view" aria-current={view === "list"}><List /></Link>
              </div>
              <SortSelect />
            </div>
          </div>

          {results.length ? (
            <>
              {/* Cards arrive on scroll — but only from the FOURTH onwards.
                  The first row is above the fold on every viewport, so revealing
                  it would (a) fade in content the browser had already painted,
                  which is decoration, and (b) make the primary results of the
                  primary browse page depend on hydration to be visible at all.
                  Below the fold the reveal earns its place: it marks where the
                  grid continues as you scroll, and it re-runs after a filter
                  change so a swapped result set reads as new. */}
              <div className={view === "list" ? "tpl-grid--list disc-list" : "disc-grid"} data-reveal-group="">
                {shown.map((t, i) => (
                  <TemplateCard key={t.slug} t={t} span={view === "list" ? undefined : spans[i]} reveal={i >= 3} />
                ))}
              </div>
              <DiscoveryReveals token={token} />
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
                <Link href={base} className="btn btn--secondary">Clear filters</Link>
                <Link href="/templates/free" className="btn btn--primary">Browse free templates</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

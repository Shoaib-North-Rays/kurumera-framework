"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, Arrow, Grid } from "@/components/Icons";
import { Stars } from "@/components/Stars";
import Image from "next/image";
import { isFree, priceLabel, scoreMatch, type Template, authorLabel, CATEGORIES, categoryLabel } from "@/lib/registry";

/**
 * The header search — a real one.
 *
 * What it replaced: `<Link href="/templates">` wearing a magnifier icon. It
 * looked like search, it was labelled "Search templates", and it did nothing
 * but navigate. Anyone who clicked it to search had to find the field on the
 * next page and start again.
 *
 * WHY AN OVERLAY AND NOT AN INLINE FIELD: the header row is already carrying a
 * brand, four nav items, sign-in and a primary CTA. An inline field wide enough
 * to type a query into pushes the CTA off at ~1100px. The overlay borrows the
 * whole screen for the duration of the task and gives it all back afterwards.
 *
 * WHAT IT SHOWS: real matches from the live registry, ranked with `scoreMatch`
 * — the SAME weighted relevance /templates uses server-side, so the overlay
 * cannot disagree with the page it hands you off to. There are seven templates
 * in the marketplace, so the whole result set is a short list; that is a reason
 * to show it, not a reason to invent categories, trends or "popular searches"
 * to pad it out. When the field is empty the only thing here is what the user
 * actually typed before, on this device. If they have never searched, the panel
 * is honestly just an input and its keyboard hints.
 */

const RECENTS_KEY = "kurumera_recent_searches";
const MAX_RECENTS = 5;
const MAX_RESULTS = 6;
const MAX_CATS = 3;

/** Price scope. Maps 1:1 onto the dedicated routes, so "See all results" hands
 *  off to the page that already applies the same filter — the overlay can never
 *  show a set /templates would disagree with. */
const SCOPES = [
  { key: "all",  label: "All",  route: "/templates" },
  { key: "free", label: "Free", route: "/templates/free" },
  { key: "paid", label: "Paid", route: "/templates/paid" },
] as const;
type ScopeKey = (typeof SCOPES)[number]["key"];

/** Splits a label on the query so the matched run can be marked. Case-
 *  insensitive, first occurrence only — enough to answer "why is this here?"
 *  without turning the row into a highlight reel. */
function markMatch(text: string, query: string) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="searchov__mark">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

function readRecents(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

function writeRecent(q: string): string[] {
  const next = [q, ...readRecents().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENTS);
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  return next;
}

/** The relay at /api/market/list returns the registry verbatim, so every field
 *  is optional. Normalised here to exactly the shape scoreMatch/priceLabel need
 *  — nothing is defaulted to a value that would read as content. */
function normalize(raw: Record<string, unknown>): Template {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    slug: str(raw.slug),
    name: str(raw.name) || str(raw.slug),
    description: str(raw.description),
    author: str(raw.author) || "Kurumera",
    latest: str(raw.latest),
    versions: [],
    installs: Number(raw.installs) || 0,
    price: Number(raw.price) || 0,
    currency: str(raw.currency) || "USD",
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => String(t).toLowerCase()) : [],
    category: str(raw.category).toLowerCase(),
    demoStore: "",
    /* WAS `""`. The relay returns a real cover URL for every template
       (https://themekit.kurumera.com/_push/market/shot?theme=<slug>) and this
       line discarded it, which is why results were a wall of text. */
    coverImage: str(raw.coverImage),
    type: raw.type === "builder" ? "builder" : "code",
    coverColor: "",
    rating: {
      count: Number((raw.rating as Record<string, unknown> | undefined)?.count) || 0,
      average: Number((raw.rating as Record<string, unknown> | undefined)?.average) || 0,
      distribution: [0, 0, 0, 0, 0],
    },
  };
}

/** Focusables, in DOM order, for the Tab trap. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SearchOverlay() {
  const router = useRouter();
  const titleId = useId();

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [all, setAll] = useState<Template[] | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const [scope, setScope] = useState<ScopeKey>("all");

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const loadStarted = useRef(false);

  /* Focus goes back where it came from. Without this a keyboard user closing
     the overlay is dumped at the top of the document and has to Tab back in. */
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  /* Opening seeds the field from the URL when there is already a query, so the
     overlay refines an existing search instead of silently discarding it.
     Read from location rather than useSearchParams: this component lives in the
     root layout, and that hook would force every route in the app to opt out of
     static rendering. */
  const openOverlay = useCallback(() => {
    let seed = "";
    try { seed = new URLSearchParams(window.location.search).get("q") || ""; } catch { /* noop */ }
    setQ(seed);
    setScope("all");
    setRecents(readRecents());
    setOpen(true);
  }, []);

  /* ── Keyboard, all of it, on ONE document listener ────────────────────────
     Closed: the shortcut that opens the overlay. Discovery — an icon-only
     trigger is easy to miss, and ⌘K / "/" is the convention for exactly this.
     Open: Escape, the Tab trap, and arrow movement down the results.

     Deliberately on the document rather than as onKeyDown on the panel. Click
     any non-focusable part of the panel — a label, the padding — and focus
     falls to <body>; a React handler bound to the overlay div would then never
     see the keystroke, and Escape would appear broken exactly when a user is
     most likely to reach for it. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) {
        const t = e.target as HTMLElement | null;
        const typing = !!t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName));
        const combo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
        if (!combo && (typing || e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey)) return;
        /* Never stack a second modal. The mobile drawer covers the header, so
           it cannot be CLICKED open from there — but the shortcut still fires,
           and two focus traps on the same document fight each other until the
           user is stuck. Standards-based check, so it also holds for anything
           modal added later. */
        if (document.querySelector('[aria-modal="true"]')) return;
        e.preventDefault();
        openOverlay();
        return;
      }

      if (e.key === "Escape") { e.preventDefault(); close(); return; }

      const panel = panelRef.current;
      if (!panel) return;

      if (e.key === "Tab") {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        const inside = !!active && panel.contains(active);
        if (e.shiftKey && (!inside || active === first)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (!inside || active === last)) { e.preventDefault(); first.focus(); }
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = Array.from(panel.querySelectorAll<HTMLElement>("[data-ov-item]"));
        if (items.length < 2) return;
        e.preventDefault();
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = e.key === "ArrowDown"
          ? (i + 1) % items.length
          : (i <= 0 ? items.length - 1 : i - 1);
        items[next]?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, openOverlay, close]);

  /* Lock the page behind the layer, and put the caret in the field. */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  /* The catalogue is fetched on FIRST OPEN, never at page load: a header must
     not cost every visitor a request for a feature most of them will not use. */
  useEffect(() => {
    if (!open || loadStarted.current) return;
    loadStarted.current = true;
    (async () => {
      try {
        const r = await fetch("/api/market/list");
        const d = await r.json();
        const raw: Record<string, unknown>[] = Array.isArray(d?.themes) ? d.themes : [];
        setAll(raw.map(normalize).filter((t) => t.slug));
      } catch {
        setAll([]); // silent: the field still submits to /templates, which does the real search
      }
    })();
  }, [open]);

  const query = q.trim();

  const inScope = useCallback(
    (t: Template) => (scope === "free" ? isFree(t) : scope === "paid" ? !isFree(t) : true),
    [scope],
  );

  const results = useMemo(() => {
    if (!all || !query) return [];
    return all
      .filter(inScope)
      .map((t) => ({ t, s: scoreMatch(t, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || b.t.installs - a.t.installs)
      .slice(0, MAX_RESULTS)
      .map((x) => x.t);
  }, [all, query, inScope]);

  /* Category suggestions. Typing "eco" should offer the Ecommerce INDEX, not
     just the templates whose text happens to contain those letters — a
     category is a destination, and it is the one the visitor usually meant.
     Only categories that actually hold something in the current scope are
     offered: a suggestion leading to an empty page is worse than none. */
  const catHits = useMemo(() => {
    if (!all || !query) return [];
    const ql = query.toLowerCase();
    return CATEGORIES
      .filter((c) => c.label.toLowerCase().includes(ql) || c.key.includes(ql))
      .map((c) => ({ ...c, n: all.filter((t) => inScope(t) && (t.category === c.key || c.match.test(`${t.category} ${t.tags.join(" ")} ${t.name}`.toLowerCase()))).length }))
      .filter((c) => c.n > 0)
      .slice(0, MAX_CATS);
  }, [all, query, inScope]);

  const submit = useCallback((value: string) => {
    const v = value.trim();
    if (v) setRecents(writeRecent(v));
    close();
    // The scope's own route, so the hand-off keeps the filter the user set here.
    const base = SCOPES.find((x) => x.key === scope)?.route || "/templates";
    router.push(v ? `${base}?q=${encodeURIComponent(v)}` : base);
  }, [close, router, scope]);

  const showRecents = !query && recents.length > 0;
  const status = !query
    ? ""
    : all === null
      ? "Searching…"
      : `${results.length} matching template${results.length === 1 ? "" : "s"}${scope === "all" ? "" : ` in ${scope}`}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="icon-btn searchov-trigger"
        aria-label="Search templates"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : openOverlay())}
      >
        <Search />
      </button>

      {open && (
        <div className="searchov">
          <div className="searchov__backdrop" onClick={close} />
          <div
            ref={panelRef}
            className="searchov__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <h2 id={titleId} className="sr-only">Search templates</h2>

            <form
              className="searchov__field"
              role="search"
              action="/templates"
              onSubmit={(e) => { e.preventDefault(); submit(q); }}
            >
              <Search />
              <input
                ref={inputRef}
                className="searchov__input"
                type="search"
                name="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search templates, industries, styles…"
                aria-label="Search templates"
                autoComplete="off"
                spellCheck={false}
                data-ov-item
              />
              <button type="button" className="searchov__close" aria-label="Close search" onClick={close}>
                <X />
              </button>
            </form>

            {/* Scope. Three buttons, not a select: the whole set is three items
                and they are the primary axis people filter on. Each maps to a
                real route, so Enter lands on a page with the same filter. */}
            <div className="searchov__scopes" role="group" aria-label="Filter by price">
              {SCOPES.map((sc) => (
                <button
                  key={sc.key}
                  type="button"
                  className={`searchov__scope${scope === sc.key ? " is-on" : ""}`}
                  aria-pressed={scope === sc.key}
                  data-ov-item
                  onClick={() => setScope(sc.key)}
                >
                  {sc.label}
                </button>
              ))}
            </div>

            <div className="searchov__body">
              <p className="sr-only" role="status" aria-live="polite">{status}</p>

              {showRecents && (
                <>
                  <span className="searchov__label">Recent searches</span>
                  {recents.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className="searchov__row"
                      data-ov-item
                      onClick={() => submit(r)}
                    >
                      <Search />
                      <span className="searchov__rowmain"><span className="searchov__name">{r}</span></span>
                    </button>
                  ))}
                </>
              )}

              {query && results.length > 0 && (
                <>
                  <span className="searchov__label">Templates</span>
                  {results.map((t) => (
                    <Link
                      key={t.slug}
                      href={`/templates/${t.slug}`}
                      className="searchov__row searchov__row--tpl"
                      data-ov-item
                      onClick={close}
                    >
                      {/* The real cover, not a placeholder tile. Every template
                          has one; a row with a grey square where the others
                          have a screenshot reads as a broken image. */}
                      {t.coverImage ? (
                        <Image
                          className="searchov__thumb"
                          src={t.coverImage}
                          alt=""
                          width={112}
                          height={80}
                          sizes="56px"
                          /* eager, not the default lazy: these are 56px tiles
                             inside a modal the user just opened and is reading
                             right now. Lazy meant the list painted as a column
                             of empty grey boxes and filled in afterwards. They
                             are only ever requested once a query is typed, so
                             this costs a closed overlay nothing. */
                          loading="eager"
                        />
                      ) : (
                        <span className="searchov__thumb searchov__thumb--none" aria-hidden />
                      )}
                      <span className="searchov__rowmain">
                        <span className="searchov__name">{markMatch(t.name, query)}</span>
                        <span className="searchov__by">
                          by {authorLabel(t.author)}
                          {t.category && <> · {categoryLabel(t.category)}</>}
                        </span>
                        <Stars rating={t.rating} size={12} className="searchov__stars" />
                      </span>
                      <span className={`searchov__price ${isFree(t) ? "free" : ""}`}>{priceLabel(t)}</span>
                    </Link>
                  ))}
                </>
              )}

              {query && catHits.length > 0 && (
                <>
                  <span className="searchov__label">Categories</span>
                  {catHits.map((c) => (
                    <Link
                      key={c.key}
                      href={`/templates/category/${c.key}`}
                      className="searchov__row"
                      data-ov-item
                      onClick={close}
                    >
                      <span className="searchov__cat" aria-hidden><Grid /></span>
                      <span className="searchov__rowmain">
                        <span className="searchov__name">{markMatch(c.label, query)}</span>
                        <span className="searchov__by">{c.n} template{c.n === 1 ? "" : "s"}</span>
                      </span>
                    </Link>
                  ))}
                </>
              )}

              {query && (
                <button
                  type="button"
                  className="searchov__row mi-arrow"
                  data-ov-item
                  onClick={() => submit(q)}
                >
                  <span className="searchov__rowmain">
                    <span className="searchov__name">
                      {all !== null && results.length === 0
                        ? `Search all templates for “${query}”`
                        : `See all results for “${query}”`}
                    </span>
                  </span>
                  <Arrow />
                </button>
              )}

              {!query && !showRecents && (
                <p className="searchov__note">
                  Search by name, industry, style or feature — or press Enter to browse every template.
                </p>
              )}
            </div>

            <div className="searchov__foot">
              <span><kbd>Enter</kbd> to search</span>
              <span><kbd>Esc</kbd> to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

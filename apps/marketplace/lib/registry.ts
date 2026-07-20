/**
 * Marketplace data layer. Reads the live theme registry from the push-service
 * (the same API the CLI + hosted page use) and normalises it for the UI. All
 * fields here are ones the registry actually returns today — nothing faked.
 */
export const MARKET_ORIGIN = process.env.KURUMERA_MARKET_ORIGIN || "https://themekit.kurumera.com";

export interface Template {
  slug: string;
  name: string;
  description: string;
  author: string;
  latest: string;
  versions: string[];
  installs: number;
  price: number;       // 0 = free
  currency: string;    // ISO, e.g. "USD"
  tags: string[];
  category: string;
  demoStore: string;
  coverImage: string;  // static screenshot URL; "" ⇒ fall back to the live preview
  /** Product type. "code" = a built Next.js theme (today); "builder" = a visual
   *  builder design package (Phase 1+). Defaults to "code" for existing listings. */
  type: "code" | "builder";
}

interface RawTheme {
  slug: string; name?: string; description?: string; author?: string;
  latest?: string; versions?: string[]; installs?: number;
  price?: number; currency?: string; tags?: string[]; category?: string; demoStore?: string; coverImage?: string;
  type?: string;
}

function normalize(t: RawTheme): Template {
  return {
    slug: t.slug,
    name: t.name || t.slug,
    description: t.description || "",
    author: t.author || "Kurumera",
    latest: t.latest || "1.0.0",
    versions: t.versions || [],
    installs: Number(t.installs) || 0,
    price: Number(t.price) || 0,
    currency: t.currency || "USD",
    tags: (t.tags || []).map((x) => String(x).toLowerCase()),
    category: (t.category || "").toLowerCase(),
    demoStore: t.demoStore || "",
    coverImage: t.coverImage || "",
    type: t.type === "builder" ? "builder" : "code",
  };
}

/** All published templates (newest/most-installed first). Cached ~60s. */
export async function fetchTemplates(): Promise<Template[]> {
  try {
    const res = await fetch(`${MARKET_ORIGIN}/_push/market`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const d = (await res.json()) as { themes?: RawTheme[] };
    return (d.themes || []).map(normalize).sort((a, b) => b.installs - a.installs);
  } catch {
    return [];
  }
}

export async function getTemplate(slug: string): Promise<Template | null> {
  const all = await fetchTemplates();
  return all.find((t) => t.slug === slug) || null;
}

/* ── Presentation helpers ────────────────────────────────────── */
export const isFree = (t: Template) => !t.price || t.price <= 0;
export const isBuilder = (t: Template) => t.type === "builder";
export function priceLabel(t: Template): string {
  if (isFree(t)) return "Free";
  return t.currency && t.currency !== "USD" ? `${t.currency} ${t.price}` : `$${t.price}`;
}
export const previewUrl = (slug: string) => `${MARKET_ORIGIN}/?market=${encodeURIComponent(slug)}`;
export const cloneUrl = (slug: string) => `${MARKET_ORIGIN}/_push/market/source?theme=${encodeURIComponent(slug)}`;

/**
 * Corner badges — only honest signals. Free (price), and a functional label
 * ONLY when it comes from real tags. No "Best Seller"/"Popular" (installs must
 * never read as sales); install count is shown as plain metadata instead.
 */
export function badges(t: Template): { label: string; kind: string }[] {
  const out: { label: string; kind: string }[] = [];
  if (isBuilder(t)) out.push({ label: "Editable in builder", kind: "builder" });
  if (isFree(t)) out.push({ label: "Free", kind: "free" });
  if (t.tags.some((x) => /ecom|store|shop/.test(x))) out.push({ label: "Ecommerce", kind: "green" });
  else if (t.tags.some((x) => /cms|blog/.test(x))) out.push({ label: "CMS", kind: "green" });
  return out.slice(0, 2);
}

/** Human feature labels derived ONLY from real tags (e.g. Ecommerce · Responsive · Modern). */
const TAG_LABELS: Record<string, string> = {
  ecommerce: "Ecommerce", store: "Ecommerce", shop: "Ecommerce", responsive: "Responsive",
  cms: "CMS", blog: "Blog", booking: "Booking", multilingual: "Multilingual", dark: "Dark",
  minimal: "Minimal", modern: "Modern", luxury: "Luxury", bold: "Bold", editorial: "Editorial",
  corporate: "Corporate", playful: "Playful", creative: "Creative",
};
export function featureLabels(t: Template, limit = 3): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of t.tags) {
    const label = TAG_LABELS[tag] || (tag.length > 2 ? tag[0].toUpperCase() + tag.slice(1) : "");
    if (label && !seen.has(label)) { seen.add(label); out.push(label); }
    if (out.length >= limit) break;
  }
  return out;
}

/* ── Categories (curated set; counts computed from real templates) ── */
export const CATEGORIES: { key: string; label: string; match: RegExp }[] = [
  { key: "business", label: "Business", match: /business|corporate|company|consult/ },
  { key: "ecommerce", label: "Ecommerce", match: /ecom|store|shop|pharmacy|retail/ },
  { key: "portfolio", label: "Portfolio", match: /portfolio|personal|resume/ },
  { key: "agency", label: "Agency", match: /agency|studio|creative/ },
  { key: "restaurant", label: "Restaurant", match: /restaurant|food|cafe|menu/ },
  { key: "realestate", label: "Real Estate", match: /real.?estate|property|housing/ },
  { key: "health", label: "Health & Fitness", match: /health|fitness|medical|pharmacy|clinic|gym/ },
  { key: "education", label: "Education", match: /education|course|school|learn/ },
  { key: "events", label: "Events", match: /event|conference|wedding/ },
  { key: "technology", label: "Technology", match: /tech|saas|software|startup/ },
  { key: "blog", label: "Blog", match: /blog|magazine|news|editorial/ },
  { key: "landing", label: "Landing Pages", match: /landing|one.?page|marketing/ },
];

export const STYLES = ["minimal", "modern", "luxury", "bold", "corporate", "playful", "dark", "editorial", "creative"];

export function matchesCategory(t: Template, key: string): boolean {
  const cat = CATEGORIES.find((c) => c.key === key);
  if (!cat) return false;
  const hay = `${t.category} ${t.tags.join(" ")} ${t.name} ${t.description}`.toLowerCase();
  return t.category === key || cat.match.test(hay);
}
export const categoryLabel = (key: string) => CATEGORIES.find((c) => c.key === key)?.label || key;

/**
 * Weighted textual relevance (per architecture note): name-exact 10 ·
 * name-contains 7 · tags 6 · category 5 · description 3 · author 2 · slug 1.
 * installs is only a tie-breaker, applied by the caller.
 */
export function scoreMatch(t: Template, q: string): number {
  const query = q.toLowerCase().trim();
  if (!query) return 0;
  const terms = query.split(/\s+/);
  let score = 0;
  for (const term of terms) {
    if (t.name.toLowerCase() === term) score += 10;
    else if (t.name.toLowerCase().includes(term)) score += 7;
    if (t.tags.some((x) => x.includes(term))) score += 6;
    if (t.category.includes(term)) score += 5;
    if (t.description.toLowerCase().includes(term)) score += 3;
    if (t.author.toLowerCase().includes(term)) score += 2;
    if (t.slug.includes(term)) score += 1;
  }
  return score;
}

export function categoryCounts(templates: Template[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of CATEGORIES) counts[c.key] = templates.filter((t) => matchesCategory(t, c.key)).length;
  return counts;
}

/** Sort options we can honestly support (no "Newest" — no publish date in the registry). */
export const SORTS: { key: string; label: string }[] = [
  { key: "relevant", label: "Most relevant" },
  { key: "installs", label: "Most installed" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "name", label: "Name: A–Z" },
];

/** Filter + sort for the discovery page (URL-driven). `style` is a tag-only filter. */
export interface Filters { category?: string; price?: "free" | "paid"; style?: string; tag?: string; author?: string; minInstalls?: number; q?: string; sort?: string; }
export function applyFilters(templates: Template[], f: Filters): Template[] {
  let list = templates.slice();
  if (f.category) list = list.filter((t) => matchesCategory(t, f.category!));
  if (f.price === "free") list = list.filter(isFree);
  if (f.price === "paid") list = list.filter((t) => !isFree(t));
  if (f.style) list = list.filter((t) => t.tags.includes(f.style!));   // tag-only
  if (f.tag) list = list.filter((t) => t.tags.includes(f.tag!));
  if (f.author) list = list.filter((t) => t.author.toLowerCase() === f.author!.toLowerCase());
  if (f.minInstalls) list = list.filter((t) => t.installs >= f.minInstalls!);

  const q = (f.q || "").trim();
  if (q) list = list.filter((t) => scoreMatch(t, q) > 0);

  const sort = f.sort || (q ? "relevant" : "installs");
  switch (sort) {
    case "relevant":
      list.sort((a, b) => (scoreMatch(b, q) - scoreMatch(a, q)) || (b.installs - a.installs));
      break;
    case "price-asc": list.sort((a, b) => a.price - b.price || b.installs - a.installs); break;
    case "price-desc": list.sort((a, b) => b.price - a.price || b.installs - a.installs); break;
    case "name": list.sort((a, b) => a.name.localeCompare(b.name)); break;
    case "installs": default: list.sort((a, b) => b.installs - a.installs); break;
  }
  return list;
}

/**
 * Demo catalogue as a `fetch` implementation for the Storefront SDK.
 *
 * The marketplace previews a theme with NO live merchant. Rather than special-case
 * routes or leak a real store's catalogue, lib/kurumera.ts hands
 * `createKurumeraClient` this injected `fetch` (gated on KURUMERA_DEMO=1) which
 * answers every Storefront endpoint from the seeded data in lib/demo-data.ts —
 * mapped into the exact backend response shapes the SDK already parses. The whole
 * real data pipeline then runs unchanged; nothing downstream knows it's a demo.
 *
 * You normally don't edit this file — customise lib/demo-data.ts instead. It is the
 * ONLY sanctioned path that feeds demo data into live routes, and only inside the
 * demo preview container (production never sets KURUMERA_DEMO).
 */
import type {
  Collection, CollectionDetail, Menu, Paginated, Product,
  ProductImage, ProductListItem, ProductOption, ProductVariant, TenantConfig,
} from "@kurumera/storefront";
import {
  demoProducts, demoCategories, demoReviewsFor,
  type DemoProduct, type DemoCategory,
} from "./demo-data";

// Fixtures must be deterministic (no Date.now — it would churn caches/screenshots).
const NOW = "2026-01-01T00:00:00.000Z";

/** Slug the demo preview reports as its store. Not a real tenant, so any client
 *  component that reaches the live API with it simply gets nothing (inert). */
export const DEMO_TENANT = "demo-store";

/* ── adapters: DemoProduct → Storefront API shapes ─────────────────────────── */

function images(p: DemoProduct): ProductImage[] {
  return p.images.map((im, i) => ({ id: `${p.handle}-img-${i}`, src: im.src, alt: im.alt || null }));
}

function listItem(p: DemoProduct): ProductListItem {
  const first = p.images[0];
  return {
    id: p.handle,
    title: p.title,
    handle: p.handle,
    vendor: p.vendor,
    product_type: p.productType,
    tags: [...p.materials.map((m) => `material:${m}`), ...p.colors.map((c) => `color:${c.name}`)],
    status: "active",
    featured_image: first ? { id: `${p.handle}-img-0`, src: first.src, alt: first.alt || null } : null,
    min_price: p.price,
    max_price: p.price,
    min_compare_at_price: p.compareAtPrice,
    available: p.inStock,
    description: p.description,
    is_best_seller: p.badges.includes("best"),
    is_deal: p.compareAtPrice != null || p.badges.includes("sale"),
    seo_title: p.title,
    seo_description: p.description.slice(0, 160),
    noindex: false,
    updated_at: NOW,
    created_at: NOW,
    rating: p.rating,
    review_count: p.reviewCount,
  };
}

function options(p: DemoProduct): ProductOption[] {
  if (!p.colors.length) return [];
  return [{
    id: `${p.handle}-opt-color`, name: "Color", position: 1,
    values: p.colors.map((c, i) => ({ id: `${p.handle}-ov${i}`, name: "Color", value: c.name, position: i + 1 })),
  }];
}

function variants(p: DemoProduct): ProductVariant[] {
  const colors = p.colors.length ? p.colors : [{ name: "Default", hex: "#000000" }];
  return colors.map((c, i) => {
    const option_values: Record<string, string> = p.colors.length ? { Color: c.name } : {};
    return {
      id: `${p.handle}-v${i}`,
      title: c.name,
      price: p.price,
      compare_at_price: p.compareAtPrice,
      available: p.inStock,
      available_quantity: p.inStock ? 24 : 0,
      inventory_tracked: true,
      option_values,
      sku: `${p.handle}-${c.name}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-"),
    };
  });
}

function detail(p: DemoProduct): Product {
  const first = p.images[0];
  return {
    ...listItem(p),
    body_html: `<p>${p.description}</p>`,
    options: options(p),
    variants: variants(p),
    images: images(p),
    available_quantity: p.inStock ? 24 : 0,
    seo_jsonld: null,
    seo_image_url: first?.src ?? "",
    seo_image_alt: first?.alt ?? "",
    canonical_url: `/products/${p.handle}`,
    published_at: NOW,
  };
}

/* ── collections: assign products to categories by keyword ─────────────────── */

function productsIn(handle: string): DemoProduct[] {
  const re = new RegExp(handle.replace(/-/g, "|"), "i");
  const matched = demoProducts.filter((p) => re.test(p.productType) || re.test(p.title) || handle === "new-arrivals");
  return matched.length ? matched : demoProducts.slice(0, 6); // never show an empty collection
}

function collection(c: DemoCategory): Collection {
  return {
    id: c.handle, title: c.title, handle: c.handle,
    description: `${c.title} — a curated selection.`,
    image: c.image.src, published_at: NOW,
    seo_title: c.title, seo_description: `Shop ${c.title.toLowerCase()}.`,
    seo_image_url: c.image.src, seo_image_alt: c.image.alt,
    canonical_url: `/collections/${c.handle}`, noindex: false, updated_at: NOW,
  };
}

function collectionDetail(c: DemoCategory): CollectionDetail {
  return { ...collection(c), products: pageOf(productsIn(c.handle).map(listItem)) };
}

/* ── menus + tenant config ─────────────────────────────────────────────────── */

function menus(): Record<string, Menu> {
  return {
    "main-menu": {
      handle: "main-menu", name: "Main menu",
      items: demoCategories.map((c) => ({
        label: c.title, href: `/collections/${c.handle}`, link_type: "collection", is_broken: false, children: [],
      })),
    },
    footer: {
      handle: "footer", name: "Footer",
      items: [
        { label: "About", href: "/pages/about", link_type: "page", is_broken: false, children: [] },
        { label: "Shipping & returns", href: "/pages/shipping", link_type: "page", is_broken: false, children: [] },
        { label: "Contact", href: "/pages/contact", link_type: "page", is_broken: false, children: [] },
      ],
    },
  };
}

function tenantConfig(): TenantConfig {
  return {
    branding: {
      store_name: "Your Store", tagline: "A demo of this theme",
      description: "This is a marketplace preview, populated with sample products.",
      logo_url: "", favicon_url: "", theme: {},
    },
    contact: { email: "hello@example.com", phone: "", whatsapp_number: "" },
    address: { formatted: "", geo_lat: null, geo_lng: null },
    social: {},
    commerce: { currency_code: "USD", country_code: "US" },
    shipping: { free_shipping_threshold: "75" },
    tenant: { slug: DEMO_TENANT, name: "Your Store" },
    opening_hours: "",
  };
}

function reviewsFor(handle: string): unknown {
  const reviews = demoReviewsFor(handle).map((r) => ({
    id: r.id, author: r.name, name: r.name, rating: r.rating,
    title: r.title, body: r.body, created_at: r.date, verified: r.verified,
  }));
  return { count: reviews.length, results: reviews };
}

/* ── list filtering (limit / offset / collection / sort / q) ───────────────── */

function pageOf<T>(results: T[]): Paginated<T> {
  return { count: results.length, next: null, previous: null, results };
}

function filtered(params: URLSearchParams): ProductListItem[] {
  const col = params.get("collection");
  let items = col ? productsIn(col) : [...demoProducts];

  const vendor = params.get("vendor");
  if (vendor) items = items.filter((p) => p.vendor === vendor);

  const q = (params.get("q") || "").trim().toLowerCase();
  if (q) items = items.filter((p) => (p.title + " " + p.description + " " + p.productType).toLowerCase().includes(q));

  const sort = params.get("sort") || "";
  const price = (p: DemoProduct) => parseFloat(p.price);
  if (sort.includes("price") && sort.includes("asc")) items.sort((a, b) => price(a) - price(b));
  else if (sort.includes("price")) items.sort((a, b) => price(b) - price(a));

  const rows = items.map(listItem);
  const offset = Number(params.get("offset") || 0) || 0;
  const limitRaw = Number(params.get("limit") || 0) || 0;
  const end = limitRaw > 0 ? offset + limitRaw : undefined;
  return rows.slice(offset, end);
}

/* ── the fetch router ──────────────────────────────────────────────────────── */

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

/** A `fetch` that answers every Storefront endpoint from the demo catalogue. */
export function makeDemoFetch(): typeof fetch {
  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    const method = ((typeof input === "object" && "method" in input ? (input as Request).method : init?.method) || "GET").toUpperCase();
    let url: URL;
    try { url = new URL(href); } catch { return json({ detail: "bad demo url" }, 400); }
    const path = url.pathname.replace(/^.*?(\/storefront\/|\/cart\/|\/cart$)/, "$1");
    const p = url.searchParams;

    if (path === "/cart/" || path === "/cart" || path.startsWith("/cart/")) {
      return json({ token: "demo-cart", lines: [] });
    }
    if (method !== "GET") return json({ detail: "demo is read-only" }, 200);

    if (path === "/storefront/products/") return json(pageOf(filtered(p)));
    if (path === "/storefront/best-sellers/") {
      const best = demoProducts.filter((x) => x.badges.includes("best"));
      return json(pageOf((best.length ? best : demoProducts.slice(0, 8)).map(listItem)));
    }
    if (path === "/storefront/deals/") {
      const deals = demoProducts.filter((x) => x.compareAtPrice != null || x.badges.includes("sale"));
      return json(pageOf((deals.length ? deals : demoProducts.slice(0, 8)).map(listItem)));
    }
    const prod = path.match(/^\/storefront\/products\/([^/]+)\/?$/);
    if (prod) {
      const found = demoProducts.find((x) => x.handle === decodeURIComponent(prod[1]));
      return found ? json(detail(found)) : json({ detail: "not found" }, 404);
    }
    const reviews = path.match(/^\/storefront\/products\/([^/]+)\/reviews\/?$/);
    if (reviews) return json(reviewsFor(decodeURIComponent(reviews[1])));

    if (path === "/storefront/collections/") return json(pageOf(demoCategories.map(collection)));
    const bySlot = path.match(/^\/storefront\/collections\/by-slot\/([^/]+)\/?$/);
    if (bySlot) return json(collectionDetail(demoCategories[0]));
    const col = path.match(/^\/storefront\/collections\/([^/]+)\/?$/);
    if (col) {
      const found = demoCategories.find((c) => c.handle === decodeURIComponent(col[1]));
      return found ? json(collectionDetail(found)) : json({ detail: "not found" }, 404);
    }

    if (path === "/storefront/search/") return json(pageOf(filtered(p)));
    if (path === "/storefront/search/autocomplete/") return json({ results: filtered(p).slice(0, 5) });
    if (path === "/storefront/menus/") return json({ menus: menus() });
    if (path === "/storefront/tenant-config/") return json(tenantConfig());
    const cms = path.match(/^\/storefront\/pages\/([^/]+)\/?$/);
    if (cms) return json({ id: cms[1], title: "About", handle: cms[1], body_html: "<p>A demo page.</p>" });

    return json({ detail: "not found (demo)" }, 404);
  };
  return impl as unknown as typeof fetch;
}

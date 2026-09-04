/**
 * Storefront analytics client for Kurumera themes.
 *
 * The backend has a full event pipeline (POST /analytics/events/ —
 * tenant-scoped, UTM-classified, idempotent by event_id). The hosted storefront
 * and the builder-rendered storefront both feed it; CLI/framework themes did
 * not, so those merchants opened Analytics and saw nothing.
 *
 * This is that feeder. It lives in the SDK rather than in the theme because
 * every theme already depends on the SDK, and a tracker copied into each theme
 * is a tracker that drifts. The contract mirrors the other two implementations
 * (website-builder src/server/analytics/track.ts, plantsmall-customer-frontend
 * src/lib/analytics.ts) so all three surfaces report the same events the same
 * way.
 *
 * Deliberately framework-agnostic: no React, no Next. A theme calls
 * `trackEvent()` from wherever it already has a client-side hook.
 *
 * Four decisions worth knowing:
 *
 * TRANSPORT — `fetch(..., { keepalive: true })`, not `sendBeacon`. Both survive
 * page-unload (an add-to-cart or checkout click navigates away immediately),
 * but sendBeacon cannot set headers, and the backend needs `X-Tenant-ID` to
 * know whose store this is: the request goes to the API host, so the Host
 * header identifies the backend, not the merchant. The slug is ALSO sent in the
 * body, so a proxy that strips the header still resolves the store.
 *
 * IDENTITY — a durable `visitor_id` (localStorage) and a per-tab `session_id`
 * (sessionStorage). First-touch UTM is captured once from the landing URL and
 * attached to every event, so a purchase attributes to the campaign that drove
 * the visit rather than to the last page before checkout.
 *
 * TENANT — resolved from `window.__KURUMERA__`/`window.__TENANT__` if the theme
 * injected it (authoritative; covers custom domains), else from a
 * `<slug>.kurumera.com` host. If neither yields a slug we do not send: the
 * backend answers an unresolved tenant with `202 {status:"dropped"}`, which
 * looks like success and silently loses the event.
 *
 * SILENCE — every failure is swallowed. An event that doesn't send is a lost
 * metric; an exception in a click handler is a broken button.
 */

/** Default platform API base. Kept in step with http.ts's DEFAULT_API_URL. */
const DEFAULT_ANALYTICS_API = "https://admin.kurumera.com/api/v1";

const VISITOR_KEY = "kurumera.visitor_id";
const SESSION_KEY = "kurumera.session_id";
const UTM_KEY = "kurumera.utm";
const FIRED_KEY = "kurumera.fired"; // durable dedupe (PURCHASE) — survives reload/new tab

/** Hosts under kurumera.com that are never a store. */
const RESERVED_HOSTS = new Set(["www", "api", "admin", "app", "themekit", "cdn", "checkout", "marketplace", "builder"]);

/** What a theme may inject on `window` to configure the tracker. */
interface KurumeraWindow {
  __KURUMERA__?: { tenant?: string; apiUrl?: string; analytics?: boolean };
  __TENANT__?: { slug?: string };
}

function win(): (Window & KurumeraWindow) | null {
  return typeof window === "undefined" ? null : (window as Window & KurumeraWindow);
}

/**
 * RFC4122-ish v4. `crypto.randomUUID` is unavailable on http:// origins in some
 * browsers, so fall back rather than lose the identity entirely.
 */
function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function stored(storage: "local" | "session", key: string): string {
  try {
    const w = win();
    if (!w) return uuid();
    const s = storage === "local" ? w.localStorage : w.sessionStorage;
    let v = s.getItem(key);
    if (!v) {
      v = uuid();
      s.setItem(key, v);
    }
    return v;
  } catch {
    // Private mode / blocked storage: a per-call id still lets the event land,
    // it just cannot be stitched to the visitor's other events.
    return uuid();
  }
}

/* ── Store resolution ──────────────────────────────────────────────────────── */

/**
 * The store slug this browser is on.
 *
 * Injected value first: a custom domain (`allinonetool.store`) has no relation
 * to the platform host and can only be resolved server-side, so a theme that
 * injects the slug is authoritative. The subdomain fallback keeps a theme that
 * has not been updated working on `<slug>.kurumera.com`.
 */
export function resolveTenantSlug(): string {
  const w = win();
  if (!w) return "";
  const k = w.__KURUMERA__?.tenant;
  if (k) return k;
  const injected = w.__TENANT__?.slug;
  if (injected) return injected;
  const host = w.location.hostname.toLowerCase();
  const m = host.match(/^([a-z0-9-]+)\.kurumera\.com$/);
  return m && !RESERVED_HOSTS.has(m[1]) ? m[1] : "";
}

function apiBase(): string {
  return win()?.__KURUMERA__?.apiUrl || DEFAULT_ANALYTICS_API;
}

/* ── First-touch UTM (attached to every event) ─────────────────────────────── */

const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

function sessionUtm(): Record<string, string> {
  const w = win();
  if (!w) return {};
  try {
    const saved = w.sessionStorage.getItem(UTM_KEY);
    if (saved) return JSON.parse(saved) as Record<string, string>;
  } catch {
    /* private mode — fall through and re-read the URL */
  }
  const params = new URLSearchParams(w.location.search);
  const utm: Record<string, string> = {};
  for (const k of UTM_PARAMS) {
    const v = params.get(k);
    if (v) utm[k] = v.slice(0, 255);
  }
  // Only persist when UTMs were actually present — a direct first hit must not
  // lock the session to "no UTM"; a later tagged page can still be captured.
  if (Object.keys(utm).length) {
    try {
      w.sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
    } catch {
      /* private mode */
    }
  }
  return utm;
}

/* ── Deduplication ─────────────────────────────────────────────────────────── */

/** In-memory guard against a re-render firing the same event twice. */
const _fired = new Set<string>();

/**
 * PURCHASE must survive a reload or the confirmation link being reopened in a
 * new tab, or one order counts as several and inflates both conversion and
 * revenue. Durable in localStorage, capped so it cannot grow forever.
 */
const PERSISTENT: ReadonlySet<string> = new Set(["PURCHASE"]);
const PERSIST_MAX = 100;

function persisted(): string[] {
  try {
    const raw = win()?.localStorage.getItem(FIRED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function remember(key: string): void {
  try {
    const next = persisted().filter((k) => k !== key);
    next.push(key);
    win()?.localStorage.setItem(FIRED_KEY, JSON.stringify(next.slice(-PERSIST_MAX)));
  } catch {
    /* private mode — the in-memory Set still covers this page load */
  }
}

/* ── Public API ────────────────────────────────────────────────────────────── */

export interface TrackOptions {
  /** Arbitrary event payload — becomes `data` on the row. */
  data?: Record<string, unknown>;
  /** Skip entirely. Marketplace previews and the theme editor pass `true`. */
  skip?: boolean;
  /**
   * Dedupe token. `EVENT:dedupeKey` fires at most once — per page load, or
   * durably for PURCHASE. e.g. product id for PRODUCT_VIEW, order id for
   * PURCHASE. Omit for events that should fire every time (PAGE_VIEW).
   */
  dedupeKey?: string;
  /** Customer id for IDENTIFY (stitches this browser to the customer). */
  customerId?: string;
}

/**
 * Fire one analytics event. Fire-and-forget: never awaited by callers, never
 * throws, and safe to call from a click handler that is about to navigate.
 */
export function trackEvent(eventType: string, opts: TrackOptions = {}): void {
  if (opts.skip) return;
  const w = win();
  if (!w) return; // server render — nothing to report from here

  // One switch for every surface that renders a theme without a real shopper:
  // the marketplace preview container (KURUMERA_DEMO=1) and the theme editor.
  // Set once by the layout, honoured here, so no call site has to remember it —
  // the reference implementation threads an `editor` flag through every widget
  // and a missed one silently pollutes a merchant's funnel.
  if (w.__KURUMERA__?.analytics === false) return;

  // No resolvable store means the backend answers 202 {status:"dropped"}, which
  // is indistinguishable from success. Don't pretend: send nothing.
  const tenant = resolveTenantSlug();
  if (!tenant) return;

  if (opts.dedupeKey) {
    const key = `${eventType}:${opts.dedupeKey}`;
    if (_fired.has(key)) return;
    if (PERSISTENT.has(eventType) && persisted().includes(key)) return;
    _fired.add(key);
    if (PERSISTENT.has(eventType)) remember(key);
  }

  try {
    const body = JSON.stringify({
      event_type: eventType,
      // Idempotency: the backend short-circuits a repeated event_id, so a
      // double-fire (double click, retry) counts once.
      event_id: uuid(),
      visitor_id: stored("local", VISITOR_KEY),
      session_id: stored("session", SESSION_KEY),
      ...(opts.customerId ? { customer_id: opts.customerId } : {}),
      source: "web",
      referrer: (typeof document !== "undefined" && document.referrer) || "",
      page_path: w.location.pathname,
      // First-touch UTM for the session — attached to every event so clicks AND
      // purchases attribute to the campaign that drove the visit.
      ...sessionUtm(),
      data: opts.data ?? {},
      // Body-level fallback: a proxied or same-origin deploy may strip the
      // X-Tenant-ID header, and the store still has to resolve.
      tenant_slug: tenant,
    });

    void fetch(`${apiBase()}/analytics/events/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-ID": tenant },
      body,
      // Survives the page being torn down by the navigation this click causes.
      keepalive: true,
      // No cookies needed; keeps this a simple cross-origin POST.
      credentials: "omit",
    }).catch(() => {
      /* a lost metric must never surface to a shopper */
    });
  } catch {
    /* identity/serialisation failure — same rule */
  }
}

/**
 * The visitor and session ids this browser is reporting under.
 *
 * Checkout is hosted on a different origin (checkout.kurumera.com), and
 * localStorage is per-origin — so without carrying these across the hand-off,
 * a shopper's browsing and their purchase are two unrelated visitors and the
 * funnel cannot be joined. Themes append these to the checkout URL.
 */
export function analyticsIdentity(): { visitor_id: string; session_id: string } {
  return {
    visitor_id: stored("local", VISITOR_KEY),
    session_id: stored("session", SESSION_KEY),
  };
}

/** Event types a storefront emits. Mirrors the backend's AnalyticsEvent.EventType. */
export const EVENT = {
  PAGE_VIEW: "PAGE_VIEW",
  PRODUCT_VIEW: "PRODUCT_VIEW",
  COLLECTION_VIEW: "COLLECTION_VIEW",
  ADD_TO_CART: "ADD_TO_CART",
  REMOVE_FROM_CART: "REMOVE_FROM_CART",
  CART_VIEW: "CART_VIEW",
  BEGIN_CHECKOUT: "BEGIN_CHECKOUT",
  CHECKOUT_STEP: "CHECKOUT_STEP",
  CHECKOUT_ERROR: "CHECKOUT_ERROR",
  PURCHASE: "PURCHASE",
  SEARCH: "SEARCH",
  SEARCH_NO_RESULTS: "SEARCH_NO_RESULTS",
  IDENTIFY: "IDENTIFY",
  CONTACT_CLICK: "CONTACT_CLICK",
} as const;

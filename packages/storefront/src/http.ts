/**
 * HTTP layer for the Storefront SDK.
 *
 * Every request carries the read-only storefront token (`ksf_…`) in the
 * `X-Kurumera-Storefront-Token` header — the backend's TenantMiddleware resolves
 * the store from it, so the SDK works off the store's own host (localhost dev,
 * headless). No user identity is granted; only public reads + public cart/checkout.
 */
import type { Paginated } from "./types.js";

/** Default platform API base — override for staging/self-hosted. */
export const DEFAULT_API_URL = "https://admin.kurumera.com/api/v1";

export interface ClientConfig {
  /** Read-only storefront token, `ksf_…` (from the dashboard / CLI). Preferred. */
  token?: string;
  /**
   * Resolve the store by its slug via `X-Tenant-ID` (subdomain / dev). One of
   * `token` / `tenant` / `domain` is required.
   */
  tenant?: string;
  /** Resolve the store by a verified custom domain via `X-Tenant-Domain`. */
  domain?: string;
  /** Platform API base URL. Defaults to {@link DEFAULT_API_URL}. */
  apiUrl?: string;
  /** Inject a fetch implementation (tests, older runtimes). Defaults to global fetch. */
  fetch?: typeof fetch;
  /**
   * Short-lived `kes_…` credential minted by the admin dashboard when a
   * merchant opens the Kurumera Editable Components content editor. Only
   * needed by `client.content.getAll()` (to see drafts) and
   * `.setDraft()`/`.uploadMedia()` (to write them) — harmless to omit, and
   * harmless to send alongside any other endpoint. Additive: does not
   * change the token/tenant/domain resolution above.
   */
  editSessionToken?: string;
  /**
   * SERVER-SIDE ONLY. The visitor-address headers of the page request this
   * client is serving, passed through exactly as they arrived.
   *
   * A storefront rendered on the server calls the platform from the server,
   * so without these every page view looks like it came from one machine —
   * and every store on that machine shares one rate limit. One crawler
   * reading one sitemap was enough to throttle pages on all of them. With
   * them, the platform can tell visitors apart and limit each one separately.
   *
   * Pass the incoming request's own `x-forwarded-for` and `cf-connecting-ip`
   * unchanged. Do not parse them, pick an address, or build a chain: the
   * platform walks the chain itself, from the right, past the hops it
   * operates, which is what stops a visitor choosing their own limit. Anything
   * a theme decided would only weaken that.
   *
   * Never set this in the browser. A browser cannot send these headers, and
   * its requests already carry the visitor's address.
   */
  forwardHeaders?: ForwardHeaders;
  /**
   * Retry a GET once when the platform answers 429 and asks to wait no more
   * than this many seconds. Default 2; 0 turns the retry off.
   *
   * Only reads, and only once: a rate limit is the platform asking for less,
   * so this absorbs a brief burst rather than pushing through a sustained one.
   */
  throttleRetryMaxWait?: number;
}

/** The visitor-address headers a server-rendered storefront may forward. */
export interface ForwardHeaders {
  "x-forwarded-for"?: string | null;
  "cf-connecting-ip"?: string | null;
}

export class KurumeraError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: unknown;
  /**
   * Seconds the platform asked the caller to wait (its `Retry-After`), when it
   * sent one — set on a 429. A theme that renders a page from this error can
   * pass it on, so a crawler backs off instead of retrying straight away.
   */
  readonly retryAfter: number | null;
  constructor(status: number, body: unknown, retryAfter: number | null = null) {
    const b = body as { error?: { code?: string; message?: string }; detail?: string } | null;
    const message =
      b?.error?.message || b?.detail || `Storefront request failed (HTTP ${status}).`;
    super(message);
    this.name = "KurumeraError";
    this.status = status;
    this.code = b?.error?.code || "storefront_error";
    this.body = body;
    this.retryAfter = retryAfter;
  }

  /** The platform rate-limited this call — a temporary condition, not a fault. */
  get throttled(): boolean {
    return this.status === 429;
  }
}

/** `Retry-After` in seconds; the HTTP-date form is accepted too. Null when absent or unreadable. */
function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d+$/.test(v)) return Number(v);
  const when = Date.parse(v);
  if (Number.isNaN(when)) return null;
  return Math.max(0, Math.ceil((when - Date.now()) / 1000));
}

/**
 * The forwarded headers to send, as received, minus anything that could not be
 * a header value at all.
 *
 * Not a parser: the platform decides what the chain means. This only refuses
 * values that would make the request itself fail — a control character makes
 * `fetch` throw, and a page must not break because a header was malformed —
 * and bounds the size, since a header is caller-supplied text.
 */
function visitorHeaders(forward: ForwardHeaders | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!forward) return out;
  for (const name of ["x-forwarded-for", "cf-connecting-ip"] as const) {
    const value = forward[name];
    if (typeof value !== "string") continue;
    const v = value.trim();
    // eslint-disable-next-line no-control-regex
    if (!v || v.length > 1024 || /[\u0000-\u001f\u007f]/.test(v)) continue;
    out[name] = v;
  }
  return out;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function queryString(query?: Query): string {
  if (!query) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

export interface Http {
  get<T>(path: string, query?: Query): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
  /** POST a `multipart/form-data` body (file uploads) — no JSON encoding, no
   * Content-Type override (the browser sets the multipart boundary itself). */
  postForm<T>(path: string, form: FormData): Promise<T>;
}

export function createHttp(config: ClientConfig): Http {
  if (!config.token && !config.tenant && !config.domain) {
    throw new Error("createKurumeraClient: pass a storefront `token` (ksf_…), a `tenant` slug, or a `domain`.");
  }
  const base = (config.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, "");
  const doFetch = config.fetch ?? globalThis.fetch;
  if (typeof doFetch !== "function") {
    throw new Error("No fetch available — pass `fetch` in the client config.");
  }
  const authHeaders: Record<string, string> = {
    ...(config.token
      ? { "X-Kurumera-Storefront-Token": config.token }
      : config.tenant
        ? { "X-Tenant-ID": config.tenant }
        : { "X-Tenant-Domain": config.domain! }),
    ...(config.editSessionToken ? { "X-Kurumera-Edit-Session": config.editSessionToken } : {}),
    // Who the page is for, when this client serves a server-rendered page.
    ...visitorHeaders(config.forwardHeaders),
  };

  const retryMaxWait = Math.max(0, config.throttleRetryMaxWait ?? 2);

  async function handleResponse<T>(res: Response): Promise<T> {
    const text = await res.text();
    const data = text ? safeJson(text) : null;
    if (!res.ok) {
      const retryAfter = res.status === 429 ? parseRetryAfter(res.headers.get("retry-after")) : null;
      throw new KurumeraError(res.status, data, retryAfter);
    }
    return data as T;
  }

  async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
    const url = base + path + queryString(opts.query);
    const send = () => doFetch(url, {
      method,
      headers: {
        ...authHeaders,
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    let res = await send();
    // One retry for a READ the platform says it can take again very shortly.
    // Never a write — a POST that was throttled must not be sent twice — and
    // never more than once, so a sustained limit still surfaces as an error.
    if (res.status === 429 && method === "GET" && retryMaxWait > 0) {
      const wait = parseRetryAfter(res.headers.get("retry-after"));
      if (wait !== null && wait <= retryMaxWait) {
        await res.text().catch(() => "");   // release the first response's body
        await new Promise((r) => setTimeout(r, Math.max(wait, 0.25) * 1000));
        res = await send();
      }
    }
    return handleResponse<T>(res);
  }

  async function requestForm<T>(path: string, form: FormData): Promise<T> {
    const url = base + path;
    // No Content-Type header — the platform's fetch sets the multipart
    // boundary itself; overriding it here would break the upload.
    const res = await doFetch(url, { method: "POST", headers: { ...authHeaders, Accept: "application/json" }, body: form });
    return handleResponse<T>(res);
  }

  return {
    get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
    patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
    del: <T>(path: string) => request<T>("DELETE", path),
    postForm: <T>(path: string, form: FormData) => requestForm<T>(path, form),
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

/** Follow a Paginated<T> to a flat array (walks `next` up to `maxPages`). */
export async function collectAll<T>(
  http: Http,
  first: Paginated<T>,
  maxPages = 20,
): Promise<T[]> {
  const out = [...first.results];
  let next = first.next;
  let pages = 1;
  while (next && pages < maxPages) {
    // `next` is an absolute URL; strip the base so the token header rides along.
    const path = next.replace(/^https?:\/\/[^/]+\/api\/v1/, "");
    const page = await http.get<Paginated<T>>(path);
    out.push(...page.results);
    next = page.next;
    pages += 1;
  }
  return out;
}

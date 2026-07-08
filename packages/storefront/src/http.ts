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
}

export class KurumeraError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: unknown;
  constructor(status: number, body: unknown) {
    const b = body as { error?: { code?: string; message?: string }; detail?: string } | null;
    const message =
      b?.error?.message || b?.detail || `Storefront request failed (HTTP ${status}).`;
    super(message);
    this.name = "KurumeraError";
    this.status = status;
    this.code = b?.error?.code || "storefront_error";
    this.body = body;
  }
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
  const authHeaders: Record<string, string> = config.token
    ? { "X-Kurumera-Storefront-Token": config.token }
    : config.tenant
      ? { "X-Tenant-ID": config.tenant }
      : { "X-Tenant-Domain": config.domain! };

  async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
    const url = base + path + queryString(opts.query);
    const res = await doFetch(url, {
      method,
      headers: {
        ...authHeaders,
        Accept: "application/json",
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    const data = text ? safeJson(text) : null;
    if (!res.ok) throw new KurumeraError(res.status, data);
    return data as T;
  }

  return {
    get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
    patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
    del: <T>(path: string) => request<T>("DELETE", path),
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

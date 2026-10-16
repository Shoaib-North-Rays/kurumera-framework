import { describe, expect, it, vi } from "vitest";
import { createHttp, KurumeraError } from "./http.js";

/**
 * Server-rendered storefronts call the platform from the server, so without the
 * visitor's address every page view looks like one machine and every store on
 * it shares a single rate limit. On 2026-10-16 one crawler reading one sitemap
 * turned 53 pages into 500s that way.
 *
 * These pin the two halves of the fix: the headers go out EXACTLY as received
 * (the platform interprets the chain, the SDK must not), and a short throttle
 * on a read is absorbed once rather than failing the page.
 */

type Call = { url: string; init: RequestInit };

function fakeFetch(...responses: Array<{ status?: number; body?: unknown; headers?: Record<string, string> }>) {
  const calls: Call[] = [];
  let i = 0;
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(i++, responses.length - 1)];
    return new Response(r.body === undefined ? "{}" : JSON.stringify(r.body), {
      status: r.status ?? 200,
      headers: r.headers,
    });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const headersOf = (c: Call) => c.init.headers as Record<string, string>;

describe("forwardHeaders", () => {
  it("sends the visitor's headers exactly as received", () => {
    const { fn, calls } = fakeFetch({});
    const http = createHttp({
      tenant: "shop", fetch: fn,
      forwardHeaders: { "x-forwarded-for": "162.158.1.1", "cf-connecting-ip": "39.40.10.20" },
    });
    return http.get("/storefront/products/").then(() => {
      const h = headersOf(calls[0]);
      expect(h["x-forwarded-for"]).toBe("162.158.1.1");
      expect(h["cf-connecting-ip"]).toBe("39.40.10.20");
    });
  });

  it("does not reorder, trim inside, or pick from a chain", async () => {
    // The platform walks the chain from the right past its own hops; anything
    // the SDK rewrote would change that answer.
    const chain = "1.2.3.4, 39.40.10.20,  162.158.1.1";
    const { fn, calls } = fakeFetch({});
    await createHttp({ tenant: "shop", fetch: fn, forwardHeaders: { "x-forwarded-for": chain } })
      .get("/storefront/menus/");
    expect(headersOf(calls[0])["x-forwarded-for"]).toBe(chain);
  });

  it("rides on every kind of request, not only reads", async () => {
    const { fn, calls } = fakeFetch({}, {}, {}, {}, {});
    const http = createHttp({ tenant: "shop", fetch: fn, forwardHeaders: { "x-forwarded-for": "39.40.10.20" } });
    await http.get("/a/");
    await http.post("/b/", { x: 1 });
    await http.patch("/c/", { x: 1 });
    await http.del("/d/");
    await http.postForm("/e/", new FormData());
    expect(calls.map((c) => headersOf(c)["x-forwarded-for"])).toEqual(Array(5).fill("39.40.10.20"));
  });

  it("sends nothing when not given — the browser and every existing caller are unchanged", async () => {
    const { fn, calls } = fakeFetch({});
    await createHttp({ tenant: "shop", fetch: fn }).get("/storefront/products/");
    const names = Object.keys(headersOf(calls[0])).map((k) => k.toLowerCase());
    expect(names).not.toContain("x-forwarded-for");
    expect(names).not.toContain("cf-connecting-ip");
  });

  it("omits an empty or missing value rather than sending a blank header", async () => {
    const { fn, calls } = fakeFetch({});
    await createHttp({
      tenant: "shop", fetch: fn,
      forwardHeaders: { "x-forwarded-for": "   ", "cf-connecting-ip": null },
    }).get("/x/");
    const names = Object.keys(headersOf(calls[0]));
    expect(names).not.toContain("x-forwarded-for");
    expect(names).not.toContain("cf-connecting-ip");
  });

  it("drops a value that could not be a header, instead of breaking the page", async () => {
    // fetch throws on a control character; a malformed header must cost the
    // platform one piece of information, not the shopper the whole page.
    const { fn, calls } = fakeFetch({});
    await createHttp({
      tenant: "shop", fetch: fn,
      forwardHeaders: { "x-forwarded-for": "1.2.3.4\r\nX-Evil: 1", "cf-connecting-ip": "x".repeat(2000) },
    }).get("/x/");
    const names = Object.keys(headersOf(calls[0]));
    expect(names).not.toContain("x-forwarded-for");
    expect(names).not.toContain("cf-connecting-ip");
  });

  it("does not let a forwarded header replace the store's own identity", async () => {
    const { fn, calls } = fakeFetch({});
    await createHttp({ tenant: "shop", fetch: fn, forwardHeaders: { "x-forwarded-for": "1.2.3.4" } }).get("/x/");
    expect(headersOf(calls[0])["X-Tenant-ID"]).toBe("shop");
  });
});

describe("throttling", () => {
  const throttled = (retryAfter?: string) => ({
    status: 429,
    body: { detail: "Request was throttled. Expected available in 1 seconds." },
    headers: retryAfter === undefined ? {} : { "Retry-After": retryAfter },
  });

  it("retries a read once when asked to wait briefly", async () => {
    vi.useFakeTimers();
    try {
      const { fn, calls } = fakeFetch(throttled("1"), { body: { ok: true } });
      const p = createHttp({ tenant: "shop", fetch: fn }).get<{ ok: boolean }>("/x/");
      await vi.advanceTimersByTimeAsync(1100);
      await expect(p).resolves.toEqual({ ok: true });
      expect(calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not retry when the wait is longer than the limit", async () => {
    const { fn, calls } = fakeFetch(throttled("9"));
    const err = await createHttp({ tenant: "shop", fetch: fn }).get("/x/").catch((e) => e);
    expect(err).toBeInstanceOf(KurumeraError);
    expect(err.throttled).toBe(true);
    expect(err.retryAfter).toBe(9);
    expect(calls).toHaveLength(1);
  });

  it("retries at most once", async () => {
    vi.useFakeTimers();
    try {
      const { fn, calls } = fakeFetch(throttled("1"), throttled("1"), throttled("1"));
      const p = createHttp({ tenant: "shop", fetch: fn }).get("/x/").catch((e) => e);
      await vi.advanceTimersByTimeAsync(5000);
      const err = await p;
      expect(err.status).toBe(429);
      expect(calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("never retries a write", async () => {
    // A throttled POST may be a form or an add-to-cart; sending it twice is
    // worse than reporting the limit.
    const { fn, calls } = fakeFetch(throttled("1"));
    const err = await createHttp({ tenant: "shop", fetch: fn }).post("/x/", {}).catch((e) => e);
    expect(err.status).toBe(429);
    expect(calls).toHaveLength(1);
  });

  it("does not retry without a Retry-After to go by", async () => {
    const { fn, calls } = fakeFetch(throttled());
    const err = await createHttp({ tenant: "shop", fetch: fn }).get("/x/").catch((e) => e);
    expect(err.retryAfter).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it("can be turned off", async () => {
    const { fn, calls } = fakeFetch(throttled("1"));
    await createHttp({ tenant: "shop", fetch: fn, throttleRetryMaxWait: 0 }).get("/x/").catch(() => null);
    expect(calls).toHaveLength(1);
  });

  it("leaves other errors exactly as they were", async () => {
    const { fn, calls } = fakeFetch({ status: 500, body: { detail: "boom" } });
    const err = await createHttp({ tenant: "shop", fetch: fn }).get("/x/").catch((e) => e);
    expect(err.status).toBe(500);
    expect(err.throttled).toBe(false);
    expect(err.retryAfter).toBeNull();
    expect(calls).toHaveLength(1);
  });
});

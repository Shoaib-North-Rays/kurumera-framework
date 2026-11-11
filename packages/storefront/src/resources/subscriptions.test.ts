import { describe, expect, it, vi } from "vitest";
import { createKurumeraClient } from "../index.js";

/**
 * KME-551: a code theme lists the store's plans and starts a checkout on the
 * store's own Stripe, holding no key. A refusal is an answer with the
 * shopper's words, never a thrown error.
 */

type Call = { url: string; init: RequestInit };

function fakeFetch(...responses: Array<{ status?: number; body?: unknown } | Error>) {
  const calls: Call[] = [];
  let i = 0;
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses[Math.min(i++, responses.length - 1)];
    if (r instanceof Error) throw r;
    return new Response(r.body === undefined ? "{}" : JSON.stringify(r.body), { status: r.status ?? 200 });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const client = (fn: typeof fetch) => createKurumeraClient({ tenant: "fitmywall", fetch: fn, apiUrl: "https://api.test/api/v1" });
const sent = (c: Call) => JSON.parse(String(c.init.body));
const headers = (c: Call) => c.init.headers as Record<string, string>;

describe("subscriptions.plans", () => {
  it("reads the store's plans for this store", async () => {
    const list = { accepting_new: true, message: "", results: [{ handle: "studio", name: "Studio" }] };
    const { fn, calls } = fakeFetch({ body: list });
    expect(await client(fn).subscriptions.plans()).toEqual(list);
    expect(calls[0].url).toBe("https://api.test/api/v1/storefront/subscriptions/plans/");
    expect(headers(calls[0])["X-Tenant-ID"]).toBe("fitmywall");
  });
});

describe("subscriptions.checkout", () => {
  it("sends the plan, period, email and return addresses, and answers Stripe's page", async () => {
    const { fn, calls } = fakeFetch({ body: { url: "https://checkout.stripe.com/c/pay/cs_1", session_id: "cs_1", trial_days: 14 } });
    const answer = await client(fn).subscriptions.checkout({
      plan: "studio", period: "year", email: "buyer@example.com",
      successUrl: "https://app.fitmywall.com/welcome", cancelUrl: "https://fitmywall.com/pricing",
      clientReferenceId: "fmw1.abc.def",
    });
    expect(answer).toEqual({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_1", sessionId: "cs_1", trialDays: 14, notice: null });
    expect(calls[0].url).toBe("https://api.test/api/v1/storefront/subscriptions/checkout/");
    expect(calls[0].init.method).toBe("POST");
    expect(sent(calls[0])).toEqual({
      plan: "studio", period: "year", email: "buyer@example.com",
      success_url: "https://app.fitmywall.com/welcome", cancel_url: "https://fitmywall.com/pricing",
      client_reference_id: "fmw1.abc.def",
    });
  });

  it("holds no key: nothing secret travels from the theme", async () => {
    const { fn, calls } = fakeFetch({ body: { url: "u", session_id: "s" } });
    await client(fn).subscriptions.checkout({ plan: "studio", period: "month", email: "b@example.com" });
    const wire = JSON.stringify({ body: sent(calls[0]), headers: headers(calls[0]) });
    expect(wire).not.toMatch(/sk_|rk_|whsec_|pk_/);
    expect(sent(calls[0])).toEqual({ plan: "studio", period: "month", email: "b@example.com" });
  });

  it("returnUrl sets both addresses unless one is given", async () => {
    const { fn, calls } = fakeFetch({ body: { url: "u", session_id: "s" } }, { body: { url: "u", session_id: "s" } });
    const c = client(fn);
    await c.subscriptions.checkout({ plan: "p", period: "month", email: "e@x.io", returnUrl: "https://shop.io/pricing" });
    await c.subscriptions.checkout({ plan: "p", period: "month", email: "e@x.io", returnUrl: "https://shop.io/r", successUrl: "https://shop.io/ok" });
    expect([sent(calls[0]).success_url, sent(calls[0]).cancel_url]).toEqual(["https://shop.io/pricing", "https://shop.io/pricing"]);
    expect([sent(calls[1]).success_url, sent(calls[1]).cancel_url]).toEqual(["https://shop.io/ok", "https://shop.io/r"]);
  });

  it("passes on the used-trial notice to say before paying", async () => {
    const notice = "You've had a free trial with this store before, so this subscription starts today.";
    const { fn } = fakeFetch({ body: { url: "u", session_id: "s", trial_days: 0, trial_used: true, notice } });
    const answer = await client(fn).subscriptions.checkout({ plan: "studio", period: "month", email: "b@example.com" });
    expect(answer).toMatchObject({ ok: true, trialDays: 0, notice });
  });

  it("a refusal resolves with its code and the shopper's words", async () => {
    const detail = "This email already has a subscription to this store.";
    const { fn } = fakeFetch({ status: 409, body: { code: "already_subscribed", detail } });
    const answer = await client(fn).subscriptions.checkout({ plan: "studio", period: "month", email: "b@example.com" });
    expect(answer).toEqual({ ok: false, status: 409, code: "already_subscribed", detail });
  });

  it("reads the platform's error envelope too", async () => {
    const { fn } = fakeFetch({ status: 400, body: { error: { code: "tenant_not_resolved", message: "Tenant could not be resolved." } } });
    const answer = await client(fn).subscriptions.checkout({ plan: "studio", period: "month", email: "b@example.com" });
    expect(answer).toEqual({ ok: false, status: 400, code: "tenant_not_resolved", detail: "Tenant could not be resolved." });
  });

  it("a throttle and a lost connection are said in words, not thrown", async () => {
    const throttled = fakeFetch({ status: 429, body: { detail: "Request was throttled. Expected available in 41 seconds." } });
    expect(await client(throttled.fn).subscriptions.checkout({ plan: "p", period: "month", email: "e@x.io" }))
      .toMatchObject({ ok: false, status: 429, code: "throttled", detail: expect.stringContaining("wait a minute") });
    const offline = fakeFetch(new TypeError("fetch failed"));
    expect(await client(offline.fn).subscriptions.checkout({ plan: "p", period: "month", email: "e@x.io" }))
      .toMatchObject({ ok: false, status: 0, code: "unreachable", detail: expect.stringContaining("couldn't reach") });
  });

  it("a refusal with no words of its own still says something", async () => {
    const { fn } = fakeFetch({ status: 502, body: {} });
    const answer = await client(fn).subscriptions.checkout({ plan: "p", period: "month", email: "e@x.io" });
    expect(answer).toMatchObject({ ok: false, status: 502, detail: expect.stringContaining("couldn't start the payment") });
  });
});

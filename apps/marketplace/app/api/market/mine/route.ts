import { NextRequest } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";
import { relay } from "@/lib/relay";

export const dynamic = "force-dynamic";

/** Proxy → push-service (server-side, so the browser stays same-origin: no CORS). */
export async function GET(req: NextRequest) {
  return relay({
    /* `store` is an optional FILTER now, not the identity — omitted, the
       push-service returns everything this person has published from every
       store they staff. Forwarded only when actually supplied, so "all mine"
       is expressed by absence rather than by an empty string that happens to
       be falsy on the other side. */
    url:
      `${MARKET_ORIGIN}/_push/market/mine` +
      (req.nextUrl.searchParams.get("store")
        ? `?store=${encodeURIComponent(req.nextUrl.searchParams.get("store") as string)}`
        : ""),
    headers: { ...(req.headers.get("authorization") ? { Authorization: req.headers.get("authorization") as string } : {}) },
    label: "mine",
  });
}

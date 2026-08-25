import { NextRequest } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";
import { relay } from "@/lib/relay";

export const dynamic = "force-dynamic";

/** Proxy → push-service (server-side, so the browser stays same-origin: no CORS). */
export async function GET(req: NextRequest) {
  return relay({
    url: `${MARKET_ORIGIN}/_push/market/purchases?store=${encodeURIComponent(req.nextUrl.searchParams.get("store") || "")}`,
    headers: { ...(req.headers.get("authorization") ? { Authorization: req.headers.get("authorization") as string } : {}) },
    label: "purchases",
  });
}

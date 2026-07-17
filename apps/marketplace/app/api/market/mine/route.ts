import { NextRequest, NextResponse } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";

export const dynamic = "force-dynamic";

/** Proxy → push-service (server-side, so the browser stays same-origin: no CORS). */
export async function GET(req: NextRequest) {
  const store = req.nextUrl.searchParams.get("store") || "";
  const auth = req.headers.get("authorization") || "";
  const r = await fetch(`${MARKET_ORIGIN}/_push/market/mine?store=${encodeURIComponent(store)}`, {
    headers: auth ? { Authorization: auth } : {},
    cache: "no-store",
  });
  return new NextResponse(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}

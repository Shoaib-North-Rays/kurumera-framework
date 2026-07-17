import { NextRequest, NextResponse } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";

export const dynamic = "force-dynamic";

// Same-origin relay to the push-service so the browser never makes a cross-origin
// call (no CORS). Owner-only delist — the Authorization header is forwarded.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const body = await req.text();
  const r = await fetch(`${MARKET_ORIGIN}/_push/market/unpublish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
    body,
    cache: "no-store",
  });
  return new NextResponse(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}

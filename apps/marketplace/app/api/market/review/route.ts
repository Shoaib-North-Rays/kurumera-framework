import { NextRequest, NextResponse } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";

export const dynamic = "force-dynamic";

/**
 * Same-origin relay for posting a review.
 *
 * The Authorization header is forwarded verbatim — the push-service, not this
 * route, decides whether the caller owns the store or holds a valid license.
 * Nothing here grants anything; it only removes the CORS hop.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const r = await fetch(`${MARKET_ORIGIN}/_push/market/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
    body: await req.text(),
    cache: "no-store",
  });
  return new NextResponse(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}

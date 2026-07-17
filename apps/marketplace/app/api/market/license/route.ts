import { NextRequest, NextResponse } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";

export const dynamic = "force-dynamic";

// Same-origin relay so the branded success page can verify a Stripe session and
// retrieve the license key without a cross-origin call.
export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get("session_id") || "";
  const r = await fetch(`${MARKET_ORIGIN}/_push/market/license?session_id=${encodeURIComponent(sid)}`, {
    cache: "no-store",
  });
  return new NextResponse(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}

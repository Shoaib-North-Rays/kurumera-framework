import { NextRequest, NextResponse } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";

export const dynamic = "force-dynamic";

/** Same-origin relay of a template's ratings (the browser stays same-origin: no CORS). */
export async function GET(req: NextRequest) {
  const theme = req.nextUrl.searchParams.get("theme") || "";
  const r = await fetch(`${MARKET_ORIGIN}/_push/market/reviews?theme=${encodeURIComponent(theme)}`, { cache: "no-store" });
  return new NextResponse(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}

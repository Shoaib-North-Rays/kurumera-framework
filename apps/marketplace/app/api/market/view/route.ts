import { NextRequest, NextResponse } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";

export const dynamic = "force-dynamic";

/** Same-origin relay for recording a listing view. The client IP the
 *  push-service dedupes on comes from X-Forwarded-For, which the edge sets. */
export async function POST(req: NextRequest) {
  const theme = req.nextUrl.searchParams.get("theme") || "";
  const r = await fetch(`${MARKET_ORIGIN}/_push/market/view?theme=${encodeURIComponent(theme)}`, {
    method: "POST",
    headers: {
      "X-Forwarded-For": req.headers.get("x-forwarded-for") || "",
      "User-Agent": req.headers.get("user-agent") || "",
    },
    cache: "no-store",
  });
  return new NextResponse(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}

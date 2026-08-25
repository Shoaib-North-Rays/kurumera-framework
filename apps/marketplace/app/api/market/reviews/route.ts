import { NextRequest } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";
import { relay } from "@/lib/relay";

export const dynamic = "force-dynamic";

/** Same-origin relay of a template's ratings (the browser stays same-origin: no CORS). */
export async function GET(req: NextRequest) {
  return relay({
    url: `${MARKET_ORIGIN}/_push/market/reviews?theme=${encodeURIComponent(req.nextUrl.searchParams.get("theme") || "")}`,
    label: "reviews",
  });
}

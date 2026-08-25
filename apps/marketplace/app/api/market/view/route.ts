import { NextRequest } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";
import { relay } from "@/lib/relay";

export const dynamic = "force-dynamic";

/** Same-origin relay for recording a listing view. The client IP the
 *  push-service dedupes on comes from X-Forwarded-For, which the edge sets. */
export async function POST(req: NextRequest) {
  return relay({
    url: `${MARKET_ORIGIN}/_push/market/view?theme=${encodeURIComponent(req.nextUrl.searchParams.get("theme") || "")}`,
    method: "POST",
    headers: {
      "X-Forwarded-For": req.headers.get("x-forwarded-for") || "",
      "User-Agent": req.headers.get("user-agent") || "",
    },
    label: "view",
  });
}

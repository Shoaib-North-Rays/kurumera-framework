import { NextRequest } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";
import { relay } from "@/lib/relay";

export const dynamic = "force-dynamic";

/**
 * Same-origin relay for posting a review.
 *
 * The Authorization header is forwarded verbatim — the push-service, not this
 * route, decides whether the caller owns the store or holds a valid license.
 * Nothing here grants anything; it only removes the CORS hop.
 */
export async function POST(req: NextRequest) {
  const payload = await req.text();
  return relay({
    url: `${MARKET_ORIGIN}/_push/market/review`,
    method: "POST",
    headers: { "Content-Type": "application/json", ...(req.headers.get("authorization") ? { Authorization: req.headers.get("authorization") as string } : {}) },
    body: payload,
    label: "review",
  });
}

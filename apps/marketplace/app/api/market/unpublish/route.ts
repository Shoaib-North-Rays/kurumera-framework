import { NextRequest } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";
import { relay } from "@/lib/relay";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const payload = await req.text();
  return relay({
    url: `${MARKET_ORIGIN}/_push/market/unpublish`,
    method: "POST",
    headers: { "Content-Type": "application/json", ...(req.headers.get("authorization") ? { Authorization: req.headers.get("authorization") as string } : {}) },
    body: payload,
    label: "unpublish",
  });
}

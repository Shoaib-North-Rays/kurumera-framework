import { NextRequest } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";
import { relay } from "@/lib/relay";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return relay({
    url: `${MARKET_ORIGIN}/_push/market/license?session_id=${encodeURIComponent(req.nextUrl.searchParams.get("session_id") || "")}`,
    label: "license",
  });
}

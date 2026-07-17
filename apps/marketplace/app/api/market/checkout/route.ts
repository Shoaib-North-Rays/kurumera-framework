import { NextRequest, NextResponse } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const r = await fetch(`${MARKET_ORIGIN}/_push/market/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });
  return new NextResponse(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}

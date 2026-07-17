import { NextRequest, NextResponse } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const body = await req.text();
  const r = await fetch(`${MARKET_ORIGIN}/_push/market/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth } : {}) },
    body,
    cache: "no-store",
  });
  return new NextResponse(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}

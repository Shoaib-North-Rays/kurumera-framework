import { NextResponse } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";

export const dynamic = "force-dynamic";

/** Same-origin relay of the public registry listing (for the client-side Saved page). */
export async function GET() {
  const r = await fetch(`${MARKET_ORIGIN}/_push/market`, { cache: "no-store" });
  return new NextResponse(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}

import { MARKET_ORIGIN } from "@/lib/registry";
import { relay } from "@/lib/relay";

export const dynamic = "force-dynamic";

/** Same-origin relay of the public registry listing (for the client-side Saved page). */
export async function GET() {
  return relay({
    url: `${MARKET_ORIGIN}/_push/market`,
    label: "list",
  });
}

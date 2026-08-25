import { NextResponse } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";

export const dynamic = "force-dynamic";

/**
 * Liveness + upstream reachability.
 *
 * The container healthcheck previously pointed at `/api/market/list`, which is
 * a real relay: every probe, every 30 seconds, forever, hit the push-service
 * and pulled the whole catalogue. That is a lot of pointless traffic, and it
 * also meant the container reported unhealthy — and would eventually be
 * restarted — whenever the *upstream* was down, which restarting this container
 * cannot fix.
 *
 * So the two questions are answered separately:
 *   · HTTP 200 means this process is alive and serving. That is what the
 *     healthcheck should key on, because that is the only thing a restart fixes.
 *   · `registry.ok` reports whether the push-service is reachable, for a human
 *     or a monitor to read. A degraded registry is reported, not restarted.
 */
export async function GET() {
  const started = Date.now();
  let registry: { ok: boolean; status?: number; ms: number; error?: string };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const r = await fetch(`${MARKET_ORIGIN}/_push/market`, { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    registry = { ok: r.ok, status: r.status, ms: Date.now() - started };
  } catch (e) {
    registry = { ok: false, ms: Date.now() - started, error: e instanceof Error ? e.name : "unknown" };
  }

  // Always 200 while the process can answer. See the note above: a non-200 here
  // would hand the orchestrator a restart loop it cannot resolve.
  return NextResponse.json(
    { ok: true, service: "marketplace", uptimeSeconds: Math.round(process.uptime()), registry },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

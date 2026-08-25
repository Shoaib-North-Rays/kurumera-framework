import { NextResponse } from "next/server";

/**
 * The one way this app talks to the push-service.
 *
 * Every route under app/api/market/ was a bare `await fetch(...)` with no
 * try/catch, no timeout, and a hardcoded `Content-Type: application/json`.
 * Three consequences, all of which mattered:
 *
 *   · A push-service that is DOWN made the handler throw, and Next answered
 *     with an HTML 500. The client then called `.json()` on HTML and got a
 *     parse error instead of the real one — worst on /purchase/complete, where
 *     the thing being fetched is a paying customer's licence key.
 *   · A push-service that HANGS hung every marketplace request behind it, with
 *     nothing to stop it but the platform's own timeout.
 *   · Nothing was logged, anywhere. The app had no console output at all, so a
 *     completely broken checkout was indistinguishable from nobody trying to
 *     buy. That is the whole of the observability story, and it is why this
 *     helper logs before it does anything else.
 *
 * Logging goes to stderr, which the container already collects. It records the
 * upstream status and how long it took — enough to answer "is checkout broken
 * and since when" from `docker logs` alone. It deliberately does not log
 * request bodies: those carry buyer email addresses.
 */

/** Long enough for a cold push-service, short enough that a hung upstream does
 *  not become a hung marketplace. */
const TIMEOUT_MS = 10_000;

export interface RelayInit {
  /** Upstream path, e.g. `/_push/market/checkout`. */
  url: string;
  method?: "GET" | "POST";
  /** Forwarded verbatim — the push-service does its own authorization. */
  headers?: Record<string, string>;
  body?: string;
  /** Names this call in the logs. Keep it short and greppable. */
  label: string;
}

export async function relay({ url, method = "GET", headers, body, label }: RelayInit): Promise<NextResponse> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const r = await fetch(url, { method, headers, body, cache: "no-store", signal: controller.signal });
    const text = await r.text();
    const ms = Date.now() - started;

    // Only the failures are noisy. A healthy marketplace should not write a log
    // line per page view, or the signal drowns in its own traffic.
    if (!r.ok) console.error(`[relay] ${label} upstream ${r.status} in ${ms}ms`);

    return new NextResponse(text, {
      status: r.status,
      // PRESERVE the upstream type. Hardcoding JSON is what made a gateway's
      // HTML error page arrive labelled as JSON.
      headers: { "Content-Type": r.headers.get("Content-Type") || "application/json" },
    });
  } catch (e) {
    const ms = Date.now() - started;
    const timedOut = e instanceof Error && e.name === "AbortError";
    console.error(`[relay] ${label} ${timedOut ? `TIMEOUT after ${TIMEOUT_MS}ms` : "FAILED"} in ${ms}ms`, e instanceof Error ? e.message : e);

    // A JSON error the client can actually read, instead of an HTML 500 that
    // explodes in `.json()`.
    return NextResponse.json(
      {
        ok: false,
        error: timedOut
          ? "The marketplace is taking too long to respond. Please try again."
          : "The marketplace is temporarily unreachable. Please try again shortly.",
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(timer);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { MARKET_ORIGIN } from "@/lib/registry";

export const dynamic = "force-dynamic";

/**
 * Download the source of a template you own — from the browser.
 *
 * The capability already existed and was already correct: `/_push/market/source`
 * asks for a valid licence key and nothing else — no store, no session. What was
 * missing was any way to USE it without the CLI. A buyer who paid on the web was
 * shown a `kurumera marketplace clone …` command and nothing else, so getting
 * the thing they bought meant installing a Node CLI and signing into it first.
 *
 * NOT the shared `relay()` helper, deliberately. That one exists for small JSON
 * payloads: it has a 10s timeout and it reads the upstream response as text,
 * which would both time out on a multi-megabyte archive and corrupt gzip by
 * decoding it. This streams the body straight through instead, so memory does
 * not scale with the size of the theme.
 *
 * The licence key is a query parameter because it has to reach the upstream
 * somehow, but it stays on our own origin (the browser never talks to
 * themekit directly) and it is never logged — the error path below records the
 * theme and the status, never the key.
 */
export async function GET(req: NextRequest) {
  const theme = (req.nextUrl.searchParams.get("theme") || "").trim();
  const license = (req.nextUrl.searchParams.get("license") || "").trim();
  const version = (req.nextUrl.searchParams.get("version") || "").trim();

  if (!theme) {
    return NextResponse.json({ error: "theme is required" }, { status: 400 });
  }

  const url =
    `${MARKET_ORIGIN}/_push/market/source?theme=${encodeURIComponent(theme)}` +
    (license ? `&license=${encodeURIComponent(license)}` : "") +
    (version ? `&version=${encodeURIComponent(version)}` : "");

  // Generous: a theme with its assets is megabytes, and this is a deliberate
  // user action with a spinner on it, not a page-render dependency.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  const started = Date.now();

  try {
    const r = await fetch(url, { cache: "no-store", signal: controller.signal });

    if (!r.ok || !r.body) {
      // 402 = paid theme, missing or invalid key. 404 = no such theme/version.
      // Pass the upstream's own words through; it explains itself well.
      const detail = await r.text().catch(() => "");
      console.error(`[source] ${theme} upstream ${r.status} in ${Date.now() - started}ms`);
      return NextResponse.json(
        { error: detail || `Download failed (${r.status}).`, status: r.status },
        { status: r.status === 402 || r.status === 404 ? r.status : 502 },
      );
    }

    return new NextResponse(r.body, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition":
          r.headers.get("Content-Disposition") || `attachment; filename="${theme}.tar.gz"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error(`[source] ${theme} failed after ${Date.now() - started}ms: ${e instanceof Error ? e.name : "unknown"}`);
    return NextResponse.json(
      { error: "Couldn't reach the download service. Please try again." },
      { status: 503 },
    );
  } finally {
    clearTimeout(timer);
  }
}

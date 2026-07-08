import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Resolve which store this request is for and pass it to Server Components via
 * request headers — the same host-based multi-tenant model the platform uses, so
 * one deployed theme serves every store. Priority:
 *   1. ?store=<slug>            (demo / preview override)
 *   2. <slug>.kurumera.com      (platform subdomain)
 *   3. any other host with a dot (merchant custom domain)
 */
const ROOT = (process.env.KURUMERA_ROOT_DOMAIN || "kurumera.com").toLowerCase();
const RESERVED = new Set(["www", "api", "admin", "app", "cdn", "builder", "themekit"]);

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  let tenant = "";
  let domain = "";

  const q = req.nextUrl.searchParams.get("store");
  const cookie = req.cookies.get("kurumera_store")?.value;
  if (q) {
    tenant = q.toLowerCase();
  } else if (host.endsWith(`.${ROOT}`)) {
    const sub = host.slice(0, -(ROOT.length + 1));
    if (sub && !sub.includes(".") && !RESERVED.has(sub)) tenant = sub;
    // A reserved host (e.g. themekit) sets no tenant — fall through to the cookie.
  } else if (host && host !== ROOT && host.includes(".") && !host.endsWith(".localhost")) {
    domain = host;
  }
  // Sticky store for the ?store= demo so internal navigation keeps context.
  if (!tenant && !domain && cookie) tenant = cookie;

  const headers = new Headers(req.headers);
  if (tenant) headers.set("x-kurumera-tenant", tenant);
  if (domain) headers.set("x-kurumera-domain", domain);

  const res = NextResponse.next({ request: { headers } });
  // Remember an explicit ?store choice so links without it still resolve.
  if (q && tenant) res.cookies.set("kurumera_store", tenant, { path: "/", sameSite: "lax" });
  return res;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|robots.txt).*)"],
};

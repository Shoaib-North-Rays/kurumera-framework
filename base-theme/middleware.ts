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

  // Kurumera Editable Components: the admin dashboard's content editor embeds
  // this storefront in an iframe with ?__kurumera_edit=<token>&__kurumera_mode=
  // edit|preview — same convention as ?store= above. Sticky-cookied so the
  // token survives internal navigation inside the iframe, same as kurumera_store
  // does; the cookie is just plumbing, apps.editable_content.EditSession.resolve()
  // on the backend is the real security boundary (a stale/forged cookie value
  // just resolves to "not editable", never a hard error).
  const editTokenParam = req.nextUrl.searchParams.get("__kurumera_edit");
  const editModeParam = req.nextUrl.searchParams.get("__kurumera_mode");
  const editTokenCookie = req.cookies.get("kurumera_edit")?.value;
  const editToken = editTokenParam || editTokenCookie || "";
  const editMode = editModeParam || (editToken ? req.cookies.get("kurumera_edit_mode")?.value : "") || "";

  const headers = new Headers(req.headers);
  if (tenant) headers.set("x-kurumera-tenant", tenant);
  if (domain) headers.set("x-kurumera-domain", domain);
  if (editToken) headers.set("x-kurumera-edit-token", editToken);
  if (editMode) headers.set("x-kurumera-edit-mode", editMode);

  const res = NextResponse.next({ request: { headers } });
  // Remember an explicit ?store choice so links without it still resolve.
  if (q && tenant) res.cookies.set("kurumera_store", tenant, { path: "/", sameSite: "lax" });
  if (editTokenParam) {
    // Short-lived cookie — a courtesy for in-iframe navigation, not the
    // security boundary (see comment above). Matches EditSession's own
    // 2-hour server-side TTL.
    res.cookies.set("kurumera_edit", editTokenParam, { path: "/", sameSite: "none", secure: true, maxAge: 2 * 60 * 60 });
    if (editModeParam) res.cookies.set("kurumera_edit_mode", editModeParam, { path: "/", sameSite: "none", secure: true, maxAge: 2 * 60 * 60 });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|robots.txt).*)"],
};

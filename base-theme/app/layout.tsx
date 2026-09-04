import "./globals.css";
import type { ReactNode } from "react";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getSettings, themeCssVars } from "@/lib/settings";
import { getTenantSlug } from "@/lib/kurumera";
import { PageViews } from "@/components/Analytics";
import { EditableProvider } from "@kurumera/editable/client";
import { resolveEditableContent } from "@kurumera/editable/server";

// The store is resolved per-request (multi-tenant), so every route renders
// dynamically — never statically prerendered at build with no store context.
export const dynamic = "force-dynamic";

// Title + favicon follow the store's own branding (settings), not a fixed name.
export async function generateMetadata() {
  const s = await getSettings();
  return {
    title: s.storeName,
    description: "A storefront powered by Kurumera.",
    ...(s.faviconUrl ? { icons: { icon: s.faviconUrl } } : {}),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [s, tenantSlug, editable] = await Promise.all([
    getSettings(),
    getTenantSlug(),
    resolveEditableContent(),
  ]);
  const css = themeCssVars(s);
  return (
    <html lang="en">
      <body>
        {/* window.__TENANT__: client-side commerce (cart/account) calls the
            platform API directly from the browser and needs its own copy of
            the resolved slug — see getTenantSlug() in lib/kurumera.ts. */}
        {tenantSlug ? (
          <script
            dangerouslySetInnerHTML={{
              __html:
                `window.__TENANT__=${JSON.stringify({ slug: tenantSlug }).replace(/</g, "\\u003c")};` +
                // window.__KURUMERA__ adds what the analytics client needs, and
                // carries the single switch that keeps preview traffic out of a
                // merchant's funnel: the marketplace preview container runs with
                // KURUMERA_DEMO=1 against a fake tenant. Setting it once here
                // means no individual call site has to remember to check it.
                `window.__KURUMERA__=${JSON.stringify({
                  tenant: tenantSlug,
                  apiUrl: process.env.KURUMERA_API_URL || undefined,
                  analytics: process.env.KURUMERA_DEMO !== "1",
                }).replace(/</g, "\\u003c")}`,
            }}
          />
        ) : null}
        {/* Per-store presentation overrides (colors / fonts / radius). */}
        {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
        {/* Kurumera Editable Components — seeded from the SAME request-scoped
            resolveEditableContent() every EditableText/EditableImage/etc.
            Server Component also calls independently (React cache()-dedupes
            to one network call per request). See @kurumera/editable's docs
            for why this needs to be a two-tier (Server + Context) setup. */}
        <EditableProvider
          mode={editable.mode}
          editToken={editable.editToken}
          tenant={editable.tenant}
          apiUrl={editable.apiUrl}
          fields={editable.fields}
        >
          <AnnouncementBar />
          <Header />
          {/* PAGE_VIEW on load and on every client-side navigation. Renders
              nothing; mounted here so a route change anywhere is counted. */}
          <PageViews />
          <main className="site-main">{children}</main>
          <Footer />
        </EditableProvider>
      </body>
    </html>
  );
}

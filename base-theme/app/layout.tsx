import "./globals.css";
import type { ReactNode } from "react";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getSettings, themeCssVars } from "@/lib/settings";
import { getTenantSlug } from "@/lib/kurumera";

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
  const [s, tenantSlug] = await Promise.all([getSettings(), getTenantSlug()]);
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
              __html: `window.__TENANT__=${JSON.stringify({ slug: tenantSlug }).replace(/</g, "\\u003c")}`,
            }}
          />
        ) : null}
        {/* Per-store presentation overrides (colors / fonts / radius). */}
        {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
        <AnnouncementBar />
        <Header />
        <main className="site-main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

import "./globals.css";
import type { ReactNode } from "react";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { getSettings, themeCssVars } from "@/lib/settings";

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
  const s = await getSettings();
  const css = themeCssVars(s);
  return (
    <html lang="en">
      <body>
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

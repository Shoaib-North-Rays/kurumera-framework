import "./globals.css";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Kurumera Store",
  description: "A storefront built with the Kurumera base theme.",
};

// The store is resolved per-request (multi-tenant), so every route renders
// dynamically — never statically prerendered at build with no store context.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="site-main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

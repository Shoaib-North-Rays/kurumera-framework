import "./globals.css";
import type { ReactNode } from "react";
import { Inter, Manrope } from "next/font/google";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

// Corrected per architecture note: Manrope (headings) + Inter (body/UI), not Sora.
const head = Manrope({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-manrope" });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter" });

const DESC =
  "Explore professionally designed free and premium website templates for businesses, stores, portfolios, agencies, restaurants and more. Customize without limits.";

export const metadata = {
  metadataBase: new URL("https://marketplace.kurumera.com"),
  title: "Kurumera Templates — Find the perfect website template",
  description: DESC,
  openGraph: {
    title: "Kurumera Templates — Find the perfect website template",
    description: DESC,
    url: "https://marketplace.kurumera.com",
    siteName: "Kurumera Templates",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Kurumera Templates", description: DESC },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${head.variable} ${body.variable}`}>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}

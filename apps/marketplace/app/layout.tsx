import "./globals.css";
// Order matters: tokens define the custom properties motion.css consumes, and
// both come AFTER globals.css so the additions layer over the existing system
// rather than being overridden by it.
import "./tokens.css";
import "./motion.css";
import type { ReactNode } from "react";
import { Inter, Manrope } from "next/font/google";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MotionRoot } from "@/components/motion/Reveal";
import { BOOT_SCRIPT } from "@/lib/motion";

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
      <head>
        {/*
          ARMS the reveal system, before paint.

          The hidden state in motion.css is gated on `html.js`, so until this
          runs every [data-reveal] element is fully visible. That ordering is
          deliberate: if JS is blocked, errors, or simply never arrives, the page
          renders complete rather than blank. Running it here — rather than from
          an effect — means the armed and un-armed states never both paint, so
          there is no flash of content that then hides itself.
        */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>
        <MotionRoot />
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}

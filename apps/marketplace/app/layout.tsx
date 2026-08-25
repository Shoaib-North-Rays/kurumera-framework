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
  /* A TEMPLATE, so pages stop hand-appending a suffix. Four different ones were
     in use — "— Kurumera", "— Kurumera Templates", "— Kurumera template" —
     because each route wrote its own. `absolute` opts a page out where it needs
     the whole title to itself. */
  title: {
    default: "Kurumera Templates — Find the perfect website template",
    template: "%s — Kurumera Templates",
  },
  description: DESC,
  openGraph: {
    title: "Kurumera Templates — Find the perfect website template",
    description: DESC,
    /* NO hardcoded `url`. It pinned every page's card to the site root: Next
       inherits a parent openGraph object wholesale when a segment does not
       declare its own, and the page's `title` does not backfill into it. So
       sharing any template rendered the homepage card, with the homepage URL —
       on a marketplace whose entire distribution is people sharing individual
       templates. metadataBase resolves the right URL per route instead. */
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
        {/* SKIP LINK — FIRST IN THE BODY, which is the whole point. There was
            none at all, and <main> had no id to target, so every keyboard and
            screen-reader user traversed the brand, four nav links, search and
            the account menu on every page, and on /templates a further ~25
            filter links, before reaching a single result.

            It sits above <Header /> because a skip link that is not the first
            focusable thing in the document skips nothing: put it after the
            header and the user has already tabbed through everything it was
            meant to bypass. Visually hidden until focused (.skip). */}
        <a className="skip" href="#main">Skip to content</a>
        <MotionRoot />
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

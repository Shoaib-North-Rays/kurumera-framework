import "./globals.css";
import type { ReactNode } from "react";
import { Inter, Manrope } from "next/font/google";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

// Corrected per architecture note: Manrope (headings) + Inter (body/UI), not Sora.
const head = Manrope({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-manrope" });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter" });

export const metadata = {
  title: "Kurumera Templates — Find the perfect website template",
  description:
    "Explore professionally designed free and premium website templates for businesses, stores, portfolios, agencies, restaurants and more. Customize without limits.",
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

import Link from "next/link";
import { Bolt } from "@/components/Icons";
import { SignInButton } from "@/components/SignInButton";
import { MobileNav } from "@/components/MobileNav";
import { SearchOverlay } from "@/components/SearchOverlay";
import { HeaderScrollState } from "@/components/HeaderScrollState";
import "@/app/chrome.css";

// Every item resolves to a real page (no dead `#`/sign-in-wall links).
export const NAV = [
  { label: "Templates", href: "/templates" },
  { label: "Free", href: "/templates/free" },
  { label: "Paid", href: "/templates/paid" },
  { label: "For Creators", href: "/creator" },
];

/**
 * Stays a SERVER component. The brand, the primary nav and the CTA are the
 * links every crawler and every no-JS visitor needs, and they cost nothing to
 * render here; only the three genuinely interactive controls (sign-in, search,
 * drawer) plus the scroll-state probe are client leaves.
 */
export function Header() {
  return (
    <header className="site-header">
      <HeaderScrollState />
      <div className="wrap site-header__row">
        <Link href="/" className="brand" aria-label="Kurumera Templates home">
          <span className="brand__mark">K</span>
          Kurumera
        </Link>
        <nav className="nav" aria-label="Primary">
          {NAV.map((n) => (
            <Link key={n.label} href={n.href}>{n.label}</Link>
          ))}
        </nav>
        <div className="header-actions">
          <SearchOverlay />
          <SignInButton />
          <Link href="/templates" className="btn btn--primary header-cta"><Bolt /> Start Building</Link>
          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";
import { KurumeraLogo } from "./KurumeraLogo";
import { AccountMenu } from "@/components/AccountMenu";
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
 * Stays a SERVER component. The brand and the primary nav are the links every
 * crawler and every no-JS visitor needs, and they cost nothing to render here;
 * only the three genuinely interactive controls (search, account, drawer) plus
 * the scroll-state probe are client leaves.
 */
export function Header() {
  return (
    <header className="site-header">
      <HeaderScrollState />
      <div className="wrap site-header__row">
        {/* The real lockup. This was a letter K in a tinted box beside the name
            in title case — neither the brand's mark nor its wordmark, which is
            lowercase. */}
        <Link href="/" className="brand" aria-label="Kurumera Templates home">
          <KurumeraLogo height={28} />
        </Link>
        <nav className="nav" aria-label="Primary">
          {NAV.map((n) => (
            <Link key={n.label} href={n.href}>{n.label}</Link>
          ))}
        </nav>
        {/* Two controls, both icons. The "Sign in" text button and the
            "Start Building" CTA are gone: the CTA linked to /templates, not the
            builder, and the hero already carries the real entry points. Account
            state now lives behind one icon that uses the Kurumera token flow
            that was already implemented. */}
        <div className="header-actions">
          <SearchOverlay />
          <AccountMenu />
          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  );
}

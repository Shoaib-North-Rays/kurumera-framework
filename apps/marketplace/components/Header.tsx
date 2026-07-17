import Link from "next/link";
import { Search, Bolt } from "@/components/Icons";
import { SignInButton } from "@/components/SignInButton";
import { MobileNav } from "@/components/MobileNav";

// Every item resolves to a real page (no dead `#`/sign-in-wall links).
export const NAV = [
  { label: "Templates", href: "/templates" },
  { label: "Free", href: "/templates/free" },
  { label: "Paid", href: "/templates/paid" },
  { label: "For Creators", href: "/creator" },
];

export function Header() {
  return (
    <header className="site-header">
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
          <Link href="/templates" className="icon-btn" aria-label="Search templates"><Search /></Link>
          <SignInButton />
          <Link href="/templates" className="btn btn--primary header-cta"><Bolt /> Start Building</Link>
          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  );
}

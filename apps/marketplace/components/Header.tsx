import Link from "next/link";
import { Search, Bolt } from "@/components/Icons";
import { SignInButton } from "@/components/SignInButton";

const NAV = [
  { label: "Templates", href: "/templates" },
  { label: "Categories", href: "/templates" },
  { label: "Free", href: "/templates/free" },
  { label: "Creators", href: "/creator" },
  { label: "Pricing", href: "#" },
  { label: "Resources", href: "#" },
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
          <Link href="#" className="btn btn--primary"><Bolt /> Start Building</Link>
        </div>
      </div>
    </header>
  );
}

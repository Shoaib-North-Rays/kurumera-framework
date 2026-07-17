import Link from "next/link";

// Only links that resolve to a real page (previously every link went to /templates).
const COLS = [
  {
    title: "Marketplace",
    links: [
      { label: "Browse templates", href: "/templates" },
      { label: "Free templates", href: "/templates/free" },
      { label: "Paid templates", href: "/templates/paid" },
      { label: "Most installed", href: "/templates?sort=installs" },
    ],
  },
  {
    title: "Creators",
    links: [{ label: "For creators", href: "/creator" }],
  },
  {
    title: "Company",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer__grid">
          <div>
            <Link href="/" className="brand"><span className="brand__mark">K</span>Kurumera</Link>
            <p className="footer__tag">Professionally designed website templates you can customize without limits — then publish in a click.</p>
          </div>
          {COLS.map((c) => (
            <nav key={c.title} className="footer__col" aria-label={c.title}>
              <h4>{c.title}</h4>
              <ul>{c.links.map((l) => (<li key={l.label}><Link href={l.href}>{l.label}</Link></li>))}</ul>
            </nav>
          ))}
        </div>
        <div className="footer__bottom">
          <span>© {year} Kurumera. All rights reserved.</span>
          <span className="footer__legal">
            <Link href="/templates">Templates</Link>
            <Link href="/creator">Creators</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

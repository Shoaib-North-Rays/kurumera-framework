import Link from "next/link";

const COLS = [
  { title: "Marketplace", links: ["Browse templates", "Categories", "Free templates", "New releases", "Staff picks"] },
  { title: "Creators", links: ["Become a creator", "Creator guidelines", "Sell templates", "Payouts"] },
  { title: "Company", links: ["About", "Pricing", "Resources", "Support"] },
];

export function Footer() {
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
              <ul>{c.links.map((l) => (<li key={l}><Link href="/templates">{l}</Link></li>))}</ul>
            </nav>
          ))}
        </div>
        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} Kurumera. All rights reserved.</span>
          <span>Templates · Creators · Pricing · Privacy · Terms</span>
        </div>
      </div>
    </footer>
  );
}

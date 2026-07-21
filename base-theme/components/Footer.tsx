import Link from "next/link";
import type { Menu } from "@kurumera/storefront";
import { getStore } from "@/lib/kurumera";
import { getSettings } from "@/lib/settings";
import { Newsletter } from "@/components/Newsletter";
import { InstagramIcon, FacebookIcon, TwitterIcon } from "@/components/Icon";

/** Store footer — newsletter, link columns (from the store's menus), social, payment. */
export async function Footer() {
  const kurumera = await getStore();
  const [menus, s] = await Promise.all([
    kurumera.navigation.all().catch(() => ({}) as Record<string, Menu>),
    getSettings(),
  ]);
  const storeName = s.storeName;

  // Prefer the store's own footer menu; otherwise a sensible default set.
  const footerMenu = menus["footer"] ?? menus["footer-menu"] ?? null;
  const columns: { title: string; links: { label: string; href: string }[] }[] = footerMenu?.items?.length
    ? footerMenu.items.map((it) => {
        const sub = ((it as { items?: { label: string; href?: string }[] }).items) ?? [];
        return { title: it.label, links: sub.map((c) => ({ label: c.label, href: c.href ?? "#" })) };
      })
    : [
        { title: "Shop", links: [{ label: "All products", href: "/search" }, { label: "New arrivals", href: "/search" }] },
        { title: "Help", links: [{ label: "Shipping", href: "/pages/shipping" }, { label: "Returns", href: "/pages/returns" }, { label: "Contact", href: "/pages/contact" }] },
        { title: "About", links: [{ label: "Our story", href: "/pages/about" }, { label: "Blog", href: "/pages/blog" }] },
      ];

  return (
    <footer className="site-footer">
      <div className="footer__top">
        <div className="footer__brand">
          <div className="footer__logo">
            {s.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={s.logoUrl} alt={storeName} className="footer__logo-img" />
              : storeName}
          </div>
          <p className="footer__tag">Quality products, delivered with care.</p>
          <div className="footer__social">
            <a href="#" aria-label="Instagram" className="icon-btn"><InstagramIcon /></a>
            <a href="#" aria-label="Facebook" className="icon-btn"><FacebookIcon /></a>
            <a href="#" aria-label="Twitter" className="icon-btn"><TwitterIcon /></a>
          </div>
        </div>

        {columns.map((col) => (
          <nav key={col.title} className="footer__col" aria-label={col.title}>
            <h3 className="footer__col-title">{col.title}</h3>
            <ul>
              {col.links.map((l) => (
                <li key={l.label}><Link href={l.href}>{l.label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="footer__news">
          <h3 className="footer__col-title">Stay in the loop</h3>
          <p className="footer__tag">Sign up for new arrivals and offers.</p>
          <Newsletter />
        </div>
      </div>

      <div className="footer__bottom">
        <span>© {new Date().getFullYear()} {storeName}. All rights reserved.</span>
        <div className="footer__pay" aria-label="Accepted payments">
          {["VISA", "MC", "AMEX", "PAYPAL"].map((p) => (
            <span key={p} className="pay-mark">{p}</span>
          ))}
        </div>
      </div>
    </footer>
  );
}

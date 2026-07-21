import Link from "next/link";
import type { Menu } from "@kurumera/storefront";
import { getStore } from "@/lib/kurumera";
import { getSettings } from "@/lib/settings";
import { SearchIcon, CartIcon } from "@/components/Icon";
import { CartCount } from "@/components/CartCount";
import { MobileMenu } from "@/components/MobileMenu";

/** Store header — logo + the store's "main-menu" (falls back to the first menu). */
export async function Header() {
  const kurumera = await getStore();
  const [menus, s] = await Promise.all([
    kurumera.navigation.all().catch(() => ({}) as Record<string, Menu>),
    getSettings(),
  ]);
  const menu = menus["main-menu"] ?? Object.values(menus)[0] ?? null;
  const items = (menu?.items ?? []).map((it) => ({ label: it.label, href: it.href ?? "#" }));

  return (
    <header className="site-header">
      <MobileMenu items={items} />
      <Link href="/" className="site-header__logo" aria-label={s.storeName}>
        {s.logoUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={s.logoUrl} alt={s.storeName} className="site-header__logo-img" />
          : s.storeName}
      </Link>
      <nav className="site-header__nav" aria-label="Primary">
        {items.map((item, i) => (
          <Link key={i} href={item.href} className="site-header__link">{item.label}</Link>
        ))}
      </nav>
      <div className="site-header__actions">
        <Link href="/search" className="icon-btn" aria-label="Search"><SearchIcon /></Link>
        <Link href="/cart" className="icon-btn cart-link" aria-label="Cart">
          <CartIcon /><CartCount />
        </Link>
      </div>
    </header>
  );
}

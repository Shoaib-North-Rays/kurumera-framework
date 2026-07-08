import Link from "next/link";
import type { Menu } from "@kurumera/storefront";
import { getStore } from "@/lib/kurumera";

/** Store header — logo + the store's own "main-menu" (falls back to the first menu). */
export async function Header() {
  const kurumera = await getStore();
  const menus = await kurumera.navigation.all().catch(() => ({}) as Record<string, Menu>);
  const menu = menus["main-menu"] ?? Object.values(menus)[0] ?? null;
  const config = (await kurumera.config.get().catch(() => ({}))) as {
    branding?: { store_name?: string; name?: string };
  };
  const storeName = config.branding?.store_name ?? config.branding?.name ?? "Store";

  return (
    <header className="site-header">
      <Link href="/" className="site-header__logo">
        {storeName}
      </Link>
      <nav className="site-header__nav" aria-label="Primary">
        {(menu?.items ?? []).map((item, i) => (
          <Link key={i} href={item.href ?? "#"} className="site-header__link">
            {item.label}
          </Link>
        ))}
      </nav>
      <Link href="/cart" className="site-header__cart" aria-label="Cart">
        Cart
      </Link>
    </header>
  );
}

import { cache } from "react";
import { getStore } from "@/lib/kurumera";

/**
 * Merchant-editable theme settings.
 *
 * The store's admin saves presentation choices (colors, fonts, hero copy,
 * announcement, value props) into `ShopSettings.theme` on the platform backend.
 * Every storefront render already fetches that per-store config via the SDK
 * (`GET /storefront/tenant-config/` → `branding`), so we read it here, normalize
 * it, and fill EVERY field with the theme's original hard-coded default. An empty
 * `theme` therefore renders exactly like the un-customized theme — existing
 * stores are unaffected until a merchant explicitly customizes.
 *
 * Colors live under `theme.colors` (NOT the first-class brand-color fields) so a
 * store's palette only changes when the merchant chooses it in the customizer.
 */

/** Curated font stacks (v1 — no webfont loading; system-safe families). */
export const FONT_STACKS: Record<string, string> = {
  system: `system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`,
  modern: `"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif`,
  serif: `Georgia, Cambria, "Times New Roman", "Noto Serif", serif`,
  rounded: `"Segoe UI", "Trebuchet MS", system-ui, ui-rounded, sans-serif`,
};
export type FontKey = keyof typeof FONT_STACKS;

export interface Cta { label: string; href: string }
export interface ValueProp { icon: string; title: string; text: string }

export interface ThemeSettings {
  storeName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  colors: { accent?: string; accentInk?: string; sale?: string; ink?: string; bg?: string; paper?: string };
  fonts: { heading: FontKey; body: FontKey; baseSize: number };
  radius: number | null;
  announcement: { show: boolean; text: string };
  hero: { show: boolean; eyebrow: string; title: string; lede: string; primary: Cta; secondary: Cta };
  valueProps: ValueProp[];
  featured: { collectionsTitle: string; productsTitle: string };
}

/** Defaults = the theme's original hard-coded copy. Keep in sync with the JSX. */
const DEFAULTS: Omit<ThemeSettings, "storeName" | "logoUrl" | "faviconUrl"> = {
  colors: {},
  fonts: { heading: "system", body: "system", baseSize: 16 },
  radius: null,
  announcement: { show: true, text: "Free shipping on orders over Rs 5,000 · Easy 30-day returns" },
  hero: {
    show: true,
    eyebrow: "New season",
    title: "Thoughtfully made, delivered to your door.",
    lede: "Explore our latest collection — quality pieces at honest prices, shipped fast.",
    primary: { label: "Shop all", href: "/search" },
    secondary: { label: "New arrivals", href: "#featured" },
  },
  valueProps: [
    { icon: "truck", title: "Free shipping", text: "On qualifying orders" },
    { icon: "refresh", title: "Easy returns", text: "30-day money back" },
    { icon: "shield", title: "Secure checkout", text: "Encrypted payments" },
    { icon: "headset", title: "Here to help", text: "Support any time" },
  ],
  featured: { collectionsTitle: "Shop by category", productsTitle: "New arrivals" },
};

const str = (v: unknown, fallback: string): string =>
  (typeof v === "string" && v.trim()) ? v : fallback;
const bool = (v: unknown, fallback: boolean): boolean =>
  (typeof v === "boolean" ? v : fallback);
const num = (v: unknown, fallback: number): number =>
  (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const fontKey = (v: unknown, fallback: FontKey): FontKey =>
  (typeof v === "string" && v in FONT_STACKS ? (v as FontKey) : fallback);
const hex = (v: unknown): string | undefined =>
  (typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : undefined);

function cta(v: unknown, d: Cta): Cta {
  const o = (v && typeof v === "object") ? (v as Record<string, unknown>) : {};
  return { label: str(o.label, d.label), href: str(o.href, d.href) };
}

/** Read + normalize this store's theme settings (memoized per request). */
export const getSettings = cache(async (): Promise<ThemeSettings> => {
  let branding: Record<string, unknown> = {};
  try {
    const kurumera = await getStore();
    const cfg = (await kurumera.config.get()) as Record<string, unknown>;
    branding = (cfg?.branding && typeof cfg.branding === "object" ? cfg.branding : {}) as Record<string, unknown>;
  } catch {
    branding = {};
  }
  const t = (branding.theme && typeof branding.theme === "object" ? branding.theme : {}) as Record<string, unknown>;

  const colorsIn = (t.colors && typeof t.colors === "object" ? t.colors : {}) as Record<string, unknown>;
  const colors: ThemeSettings["colors"] = {};
  for (const k of ["accent", "accentInk", "sale", "ink", "bg", "paper"] as const) {
    const h = hex(colorsIn[k]);
    if (h) colors[k] = h;
  }

  const typoIn = (t.typography && typeof t.typography === "object" ? t.typography : {}) as Record<string, unknown>;
  const annIn = (t.announcement && typeof t.announcement === "object" ? t.announcement : {}) as Record<string, unknown>;
  const heroIn = (t.hero && typeof t.hero === "object" ? t.hero : {}) as Record<string, unknown>;
  const featIn = (t.featured && typeof t.featured === "object" ? t.featured : {}) as Record<string, unknown>;

  const vpIn = Array.isArray(t.valueProps) ? t.valueProps : null;
  const valueProps: ValueProp[] = vpIn
    ? vpIn.slice(0, 6).map((raw, i) => {
        const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        const d = DEFAULTS.valueProps[i] ?? { icon: "star", title: "", text: "" };
        return { icon: str(o.icon, d.icon), title: str(o.title, d.title), text: str(o.text, d.text) };
      })
    : DEFAULTS.valueProps;

  return {
    storeName: str(branding.store_name ?? branding.name, "Store"),
    logoUrl: (typeof branding.logo_url === "string" && branding.logo_url) ? branding.logo_url : null,
    faviconUrl: (typeof branding.favicon_url === "string" && branding.favicon_url) ? branding.favicon_url : null,
    colors,
    fonts: {
      heading: fontKey(typoIn.heading, DEFAULTS.fonts.heading),
      body: fontKey(typoIn.body, DEFAULTS.fonts.body),
      baseSize: Math.min(22, Math.max(13, Math.round(num(typoIn.baseSize, DEFAULTS.fonts.baseSize)))),
    },
    radius: (typeof t.radius === "number" && Number.isFinite(t.radius)) ? Math.min(32, Math.max(0, t.radius)) : DEFAULTS.radius,
    announcement: { show: bool(annIn.show, DEFAULTS.announcement.show), text: str(annIn.text, DEFAULTS.announcement.text) },
    hero: {
      show: bool(heroIn.show, DEFAULTS.hero.show),
      eyebrow: str(heroIn.eyebrow, DEFAULTS.hero.eyebrow),
      title: str(heroIn.title, DEFAULTS.hero.title),
      lede: str(heroIn.lede, DEFAULTS.hero.lede),
      primary: cta(heroIn.primaryCta, DEFAULTS.hero.primary),
      secondary: cta(heroIn.secondaryCta, DEFAULTS.hero.secondary),
    },
    valueProps,
    featured: {
      collectionsTitle: str(featIn.collectionsTitle, DEFAULTS.featured.collectionsTitle),
      productsTitle: str(featIn.productsTitle, DEFAULTS.featured.productsTitle),
    },
  };
});

/** Build the `:root` override CSS from settings (empty string when nothing set). */
export function themeCssVars(s: ThemeSettings): string {
  const v: string[] = [];
  if (s.colors.accent) v.push(`--accent:${s.colors.accent}`);
  if (s.colors.accentInk) v.push(`--accent-ink:${s.colors.accentInk}`);
  if (s.colors.sale) v.push(`--sale:${s.colors.sale}`);
  if (s.colors.ink) v.push(`--ink:${s.colors.ink}`);
  if (s.colors.bg) v.push(`--bg:${s.colors.bg}`);
  if (s.colors.paper) v.push(`--paper:${s.colors.paper}`);
  if (s.radius != null) v.push(`--radius:${s.radius}px`);
  v.push(`--font-heading:${FONT_STACKS[s.fonts.heading]}`);
  v.push(`--font-body:${FONT_STACKS[s.fonts.body]}`);
  v.push(`--fs-base:${s.fonts.baseSize}px`);
  return v.length ? `:root{${v.join(";")}}` : "";
}

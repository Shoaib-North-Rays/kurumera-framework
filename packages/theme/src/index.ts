/**
 * @kurumera/theme — config + runtime helpers for Kurumera Next.js themes.
 *
 * `defineTheme` is the typed entry point a theme's `theme.config.ts` exports; the
 * CLI's `theme check` and the backend build service read the returned object to
 * validate the route contract and surface the merchant-editable settings.
 */

/** Storefront routes a theme can provide a template for (doc §17 contract). */
export type ThemeRoute =
  | "home"
  | "product"
  | "collection"
  | "cart"
  | "search"
  | "page";

/** Routes every theme MUST implement to pass `theme check`. */
export const REQUIRED_ROUTES: readonly ThemeRoute[] = [
  "home",
  "product",
  "collection",
  "cart",
  "search",
  "page",
] as const;

export interface ThemeCompatibility {
  next?: string;
  kurumera?: string;
}

/** Merchant-editable settings a theme opts into (surfaced in the dashboard). */
export interface ThemeSettings {
  colors?: boolean;
  typography?: boolean;
  productCards?: boolean;
  navigation?: boolean;
  [key: string]: boolean | undefined;
}

export interface ThemeConfig {
  name: string;
  version: string;
  framework: "nextjs";
  compatibility?: ThemeCompatibility;
  routes: ThemeRoute[];
  settings?: ThemeSettings;
}

/**
 * Identity helper that types + returns a theme config. Kept a pass-through so the
 * same object is available at build time (validation) and runtime (rendering).
 *
 *   export default defineTheme({ name: "Fashion Starter", version: "1.0.0", … });
 */
export function defineTheme(config: ThemeConfig): ThemeConfig {
  return config;
}

/** Which required routes a config is missing — used by `theme check`. */
export function missingRoutes(config: ThemeConfig): ThemeRoute[] {
  const have = new Set(config.routes);
  return REQUIRED_ROUTES.filter((r) => !have.has(r));
}

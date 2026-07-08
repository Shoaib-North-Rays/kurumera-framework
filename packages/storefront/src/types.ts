/**
 * Storefront API types.
 *
 * Grounded in the backend serializers (api/v1/storefront/serializers.py) so the
 * shapes match what the endpoints actually return. Monetary values arrive as
 * DECIMAL STRINGS (e.g. "1299.00"), never numbers — format at the edge. Fields we
 * are not exhaustively modelling yet carry an index signature so real responses
 * never break typing; we tighten these as the theme surface grows.
 */

/** A decimal money string, e.g. "1299.00". */
export type Money = string;

/** DRF page envelope used by list endpoints. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ProductImage {
  id: string;
  src: string | null;
  alt: string | null;
}

/** A product as returned by the LIST endpoint (card-sized payload). */
export interface ProductListItem {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  tags: string[];
  status: string;
  featured_image: ProductImage | null;
  min_price: Money;
  max_price: Money;
  min_compare_at_price: Money | null;
  available: boolean;
  description: string;
  is_best_seller: boolean;
  is_deal: boolean;
  seo_title: string;
  seo_description: string;
  noindex: boolean;
  updated_at: string;
  created_at: string;
  [k: string]: unknown;
}

export interface ProductOptionValue {
  id: string;
  name: string;
  value: string;
  position: number;
}

export interface ProductOption {
  id: string;
  name: string;
  position: number;
  values: ProductOptionValue[];
}

export interface ProductVariant {
  id: string;
  title?: string;
  price: Money;
  compare_at_price: Money | null;
  available: boolean;
  available_quantity: number;
  inventory_tracked: boolean;
  /** Selected option values, e.g. { Size: "M", Color: "Green" }. */
  option_values: Record<string, string>;
  sku?: string;
  [k: string]: unknown;
}

/** A product as returned by the DETAIL endpoint (full PDP payload). */
export interface Product extends ProductListItem {
  body_html: string;
  options: ProductOption[];
  variants: ProductVariant[];
  images: ProductImage[];
  available_quantity: number;
  seo_jsonld: unknown;
  seo_image_url: string;
  seo_image_alt: string;
  canonical_url: string;
  published_at: string | null;
}

export interface Collection {
  id: string;
  title: string;
  handle: string;
  description: string;
  image: string | null;
  published_at: string | null;
  seo_title: string;
  seo_description: string;
  seo_image_url: string;
  seo_image_alt: string;
  canonical_url: string;
  noindex: boolean;
  updated_at: string;
  [k: string]: unknown;
}

/** A collection detail response — the collection plus its products page. */
export interface CollectionDetail extends Collection {
  products?: Paginated<ProductListItem> | ProductListItem[];
}

export interface MenuItem {
  label: string;
  /** Resolved href, or null when the target is broken/deleted. */
  href: string | null;
  link_type: string;
  is_broken: boolean;
  children: MenuItem[];
}

export interface Menu {
  handle: string;
  name: string;
  items: MenuItem[];
}

export interface CmsPage {
  id: string;
  title: string;
  handle: string;
  body_html?: string;
  [k: string]: unknown;
}

/** Store branding / defaults from /storefront/tenant-config/. Loosely typed. */
export interface TenantConfig {
  [k: string]: unknown;
}

/** Token-based cart. Line/total shapes are permissive until the cart theme UI lands. */
export interface Cart {
  token: string;
  lines?: unknown[];
  [k: string]: unknown;
}

export interface ProductListParams {
  limit?: number;
  offset?: number;
  page?: number;
  collection?: string;
  vendor?: string;
  tag?: string;
  sort?: string;
  [k: string]: string | number | undefined;
}

export interface SearchParams {
  limit?: number;
  offset?: number;
  [k: string]: string | number | undefined;
}

/**
 * DEMO CATALOGUE — marketplace-preview data ONLY.
 *
 * Every product, price and review below is INVENTED. None of it comes from a
 * merchant's Storefront API. It exists so your theme can be shown fully populated
 * in the marketplace preview WITHOUT a live store connected — see lib/demo-fetch.ts,
 * which maps this into the Storefront API shapes and is used only when the preview
 * container runs with KURUMERA_DEMO=1.
 *
 * ✎ CUSTOMISE THIS FILE. Replace the products, categories and reviews with ones
 *   that suit your theme (a fashion theme wants garments; a furniture theme wants
 *   furniture). Keep the exported names + shapes — lib/demo-fetch.ts reads them.
 *   Photography here is royalty-free from Unsplash.
 */

export interface DemoImage {
  src: string;
  alt: string;
}

function shot(id: string, alt: string, w = 1000): DemoImage {
  return { src: `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`, alt };
}

export interface DemoColor {
  name: string;
  hex: string;
}

/** Maps to your card badge styles (sale / new / best / limited). */
export type DemoBadge = "sale" | "new" | "best" | "limited";

export interface DemoProduct {
  handle: string;
  title: string;
  /** Decimal strings, matching how the Storefront API returns money. */
  price: string;
  compareAtPrice: string | null;
  productType: string;
  vendor: string;
  colors: DemoColor[];
  materials: string[];
  rating: number;
  reviewCount: number;
  description: string;
  badges: DemoBadge[];
  images: DemoImage[];
  inStock: boolean;
}

export const demoProducts: DemoProduct[] = [
  {
    handle: "everyday-tote",
    title: "Everyday Tote",
    price: "89.00",
    compareAtPrice: "119.00",
    productType: "Bags",
    vendor: "Atelier Co.",
    colors: [{ name: "Tan", hex: "#C08A5A" }, { name: "Black", hex: "#222222" }, { name: "Sage", hex: "#8A9A82" }],
    materials: ["Full-grain leather", "Cotton lining"],
    rating: 4.7,
    reviewCount: 92,
    description: "A structured leather tote roomy enough for a laptop, with a magnetic top closure and an interior zip pocket.",
    badges: ["sale", "best"],
    images: [
      shot("photo-1584917865442-de89df76afd3", "Everyday Tote in tan leather"),
      shot("photo-1590874103328-eac38a683ce7", "Everyday Tote held on the shoulder"),
    ],
    inStock: true,
  },
  {
    handle: "merino-crew-knit",
    title: "Merino Crew Knit",
    price: "128.00",
    compareAtPrice: null,
    productType: "Knitwear",
    vendor: "Atelier Co.",
    colors: [{ name: "Oat", hex: "#D8C9B2" }, { name: "Navy", hex: "#243044" }, { name: "Rust", hex: "#9C5B38" }],
    materials: ["100% merino wool"],
    rating: 4.8,
    reviewCount: 140,
    description: "A midweight crew-neck knit in soft extra-fine merino, cut for an easy regular fit that layers cleanly.",
    badges: ["best"],
    images: [
      shot("photo-1576566588028-4147f3842f27", "Merino Crew Knit in oat"),
      shot("photo-1620799140408-edc6dcb6d633", "Merino Crew Knit folded"),
    ],
    inStock: true,
  },
  {
    handle: "canvas-low-sneaker",
    title: "Canvas Low Sneaker",
    price: "74.00",
    compareAtPrice: "95.00",
    productType: "Footwear",
    vendor: "Field & Form",
    colors: [{ name: "Off-white", hex: "#EFEBE2" }, { name: "Olive", hex: "#6E7A56" }],
    materials: ["Organic canvas", "Rubber sole"],
    rating: 4.5,
    reviewCount: 63,
    description: "A clean low-top sneaker on a cupsole, built from heavyweight organic canvas with a cushioned insole.",
    badges: ["sale"],
    images: [
      shot("photo-1595950653106-6c9ebd614d3a", "Canvas Low Sneaker in off-white"),
      shot("photo-1600185365483-26d7a4cc7519", "Canvas Low Sneaker side profile"),
    ],
    inStock: true,
  },
  {
    handle: "ceramic-pour-over",
    title: "Ceramic Pour-Over Set",
    price: "58.00",
    compareAtPrice: null,
    productType: "Kitchen",
    vendor: "Field & Form",
    colors: [{ name: "Bone", hex: "#E7E1D5" }, { name: "Slate", hex: "#4A4E52" }],
    materials: ["Stoneware ceramic"],
    rating: 4.9,
    reviewCount: 78,
    description: "A hand-glazed stoneware dripper and carafe that brews a clean, bright cup — dishwasher safe.",
    badges: ["new"],
    images: [
      shot("photo-1495474472287-4d71bcdd2085", "Ceramic Pour-Over Set with coffee"),
      shot("photo-1442512595331-e89e73853f31", "Ceramic Pour-Over on a counter"),
    ],
    inStock: true,
  },
  {
    handle: "linen-throw-blanket",
    title: "Washed Linen Throw",
    price: "96.00",
    compareAtPrice: null,
    productType: "Home",
    vendor: "Atelier Co.",
    colors: [{ name: "Clay", hex: "#B4674A" }, { name: "Fog", hex: "#C9CCC7" }, { name: "Forest", hex: "#1E3A31" }],
    materials: ["Stonewashed linen"],
    rating: 4.6,
    reviewCount: 51,
    description: "A generously sized throw in softened, pre-washed linen with a subtle fringe — light in summer, layerable in winter.",
    badges: [],
    images: [
      shot("photo-1522771739844-6a9f6d5f14af", "Washed Linen Throw draped on a chair"),
      shot("photo-1616627561950-9f746e330187", "Washed Linen Throw folded"),
    ],
    inStock: true,
  },
  {
    handle: "field-watch",
    title: "Field Watch 38mm",
    price: "215.00",
    compareAtPrice: "260.00",
    productType: "Accessories",
    vendor: "Field & Form",
    colors: [{ name: "Sand dial", hex: "#D9C7A3" }, { name: "Black dial", hex: "#222222" }],
    materials: ["Stainless steel", "Leather strap"],
    rating: 4.8,
    reviewCount: 110,
    description: "A pared-back 38mm field watch with a sapphire crystal, a quiet automatic movement and a quick-release leather strap.",
    badges: ["sale", "limited"],
    images: [
      shot("photo-1523275335684-37898b6baf30", "Field Watch on a wrist"),
      shot("photo-1524805444758-089113d48a6d", "Field Watch face detail"),
    ],
    inStock: true,
  },
];

export interface DemoCategory {
  handle: string;
  title: string;
  count: number;
  image: DemoImage;
}

export const demoCategories: DemoCategory[] = [
  { handle: "new-arrivals", title: "New Arrivals", count: 24, image: shot("photo-1445205170230-053b83016050", "A styled flat-lay of new-season products") },
  { handle: "apparel", title: "Apparel", count: 38, image: shot("photo-1489987707025-afc232f7ea0f", "Folded knitwear on a shelf") },
  { handle: "home", title: "Home & Living", count: 29, image: shot("photo-1616486338812-3dadae4b4ace", "A styled living room") },
  { handle: "accessories", title: "Accessories", count: 17, image: shot("photo-1523275335684-37898b6baf30", "A watch and small leather goods") },
];

export interface DemoReview {
  id: string;
  /** Handle of the demo product this review belongs to. */
  product: string;
  name: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  verified: boolean;
}

export const demoReviews: DemoReview[] = [
  { id: "r1", product: "everyday-tote", name: "Maya R.", rating: 5, date: "2026-05-12", title: "Goes with everything", body: "The leather softened beautifully after a couple of weeks and it holds far more than it looks.", verified: true },
  { id: "r2", product: "merino-crew-knit", name: "Daniel P.", rating: 5, date: "2026-04-28", title: "Perfect weight", body: "Not too heavy, not scratchy at all. I bought a second in navy.", verified: true },
  { id: "r3", product: "field-watch", name: "Sofia L.", rating: 4, date: "2026-05-02", title: "Understated and well made", body: "Reads clearly and the strap swap is genuinely quick. Wish it came in more dial colours.", verified: true },
];

export function demoReviewsFor(handle: string): DemoReview[] {
  return demoReviews.filter((r) => r.product === handle).sort((a, b) => b.date.localeCompare(a.date));
}

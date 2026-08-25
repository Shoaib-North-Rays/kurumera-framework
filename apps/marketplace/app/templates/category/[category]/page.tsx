import { notFound } from "next/navigation";
import { DiscoveryView } from "@/components/DiscoveryView";
import { CATEGORIES, categoryLabel } from "@/lib/registry";
import type { SP } from "@/lib/params";

export const dynamic = "force-dynamic";

/**
 * Is this a category we actually have?
 *
 * Nothing checked. `categoryLabel()` falls through to `|| key`, so
 * /templates/category/anything-at-all returned HTTP 200 with
 * "<h1>anything-at-all templates</h1>" and an empty results page — an
 * indexable, unbounded supply of thin pages that any crawler or stale link
 * could mint. The sibling [slug] route has always called notFound() for an
 * unknown template; this is the same guard, which it should have had from the
 * start.
 */
const isKnown = (key: string) => CATEGORIES.some((c) => c.key === key);

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.key }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!isKnown(category)) return { title: "Page not found", robots: { index: false } };
  return {
    title: `${categoryLabel(category)} website templates`,
    description: `Free and premium ${categoryLabel(category).toLowerCase()} website templates you can preview live and customise in the Kurumera builder.`,
    alternates: { canonical: `/templates/category/${category}` },
  };
}

export default async function CategoryPage({
  params, searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<SP>;
}) {
  const { category } = await params;
  if (!isKnown(category)) notFound();
  return <DiscoveryView params={await searchParams} forced={{ category }} base={`/templates/category/${category}`} />;
}

import { DiscoveryView } from "@/components/DiscoveryView";
import { CATEGORIES, categoryLabel } from "@/lib/registry";
import type { SP } from "@/lib/params";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.key }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  return { title: `${categoryLabel(category)} website templates — Kurumera` };
}

export default async function CategoryPage({
  params, searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<SP>;
}) {
  const { category } = await params;
  return <DiscoveryView params={await searchParams} forced={{ category }} />;
}

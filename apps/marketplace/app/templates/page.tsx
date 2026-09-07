import { Suspense } from "react";
import type { Metadata } from "next";
import { DiscoverySkeleton } from "@/components/DiscoverySkeleton";
import { DiscoveryView } from "@/components/DiscoveryView";
import { categoryLabel } from "@/lib/registry";
import { spGet, type SP } from "@/lib/params";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const q = spGet(sp, "q"), category = spGet(sp, "category"), price = spGet(sp, "price");
  let title = "All templates";
  if (q) title = `“${q}” templates`;
  else if (category) title = `${categoryLabel(category)} templates`;
  else if (price === "free") title = "Free templates";
  else if (price === "paid") title = "Premium templates";
    /* CANONICAL, pointing at the bare route. Discovery generates a large
     combinatorial URL space — ?view=list duplicates every grid page, five sort
     values duplicate every listing, ?q= is unbounded, and /templates/free is
     the same content as /templates?price=free. Every one returns 200 and is
     indexable. This collapses them onto one address so the crawl budget lands
     on the catalogue rather than on permutations of it. */
  return {
    alternates: { canonical: "/templates" }, title: `${title} — Kurumera Templates` };
}

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    // Suspense HERE, not a route-level loading.tsx: a segment-wide
    // boundary flushes before the page runs, which commits a 200 and
    // makes any later notFound() a soft 404.
    <Suspense fallback={<DiscoverySkeleton />}>
      <DiscoveryView params={await searchParams} />
    </Suspense>
  );
}

import { Suspense } from "react";
import { DiscoverySkeleton } from "@/components/DiscoverySkeleton";
import { DiscoveryView } from "@/components/DiscoveryView";
import type { SP } from "@/lib/params";

export const dynamic = "force-dynamic";
  /* CANONICAL, pointing at the bare route. Discovery generates a large
     combinatorial URL space — ?view=list duplicates every grid page, five sort
     values duplicate every listing, ?q= is unbounded, and /templates/free is
     the same content as /templates?price=free. Every one returns 200 and is
     indexable. This collapses them onto one address so the crawl budget lands
     on the catalogue rather than on permutations of it. */
export const metadata = { alternates: { canonical: "/templates/paid" }, title: "Premium website templates" };

export default async function PaidTemplatesPage({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    // Suspense HERE, not a route-level loading.tsx: a segment-wide
    // boundary flushes before the page runs, which commits a 200 and
    // makes any later notFound() a soft 404.
    <Suspense fallback={<DiscoverySkeleton />}>
      <DiscoveryView params={await searchParams} forced={{ price: "paid" }} base="/templates/paid" />
    </Suspense>
  );
}

import { DiscoveryView } from "@/components/DiscoveryView";
import type { SP } from "@/lib/params";

export const dynamic = "force-dynamic";
  /* CANONICAL, pointing at the bare route. Discovery generates a large
     combinatorial URL space — ?view=list duplicates every grid page, five sort
     values duplicate every listing, ?q= is unbounded, and /templates/free is
     the same content as /templates?price=free. Every one returns 200 and is
     indexable. This collapses them onto one address so the crawl budget lands
     on the catalogue rather than on permutations of it. */
export const metadata = { alternates: { canonical: "/templates/free" }, title: "Free website templates" };

export default async function FreeTemplatesPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <DiscoveryView params={await searchParams} forced={{ price: "free" }} base="/templates/free" />;
}

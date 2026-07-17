import { DiscoveryView } from "@/components/DiscoveryView";
import type { SP } from "@/lib/params";

export const dynamic = "force-dynamic";

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <DiscoveryView params={await searchParams} />;
}

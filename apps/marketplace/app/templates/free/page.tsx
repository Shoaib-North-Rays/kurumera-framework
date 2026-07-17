import { DiscoveryView } from "@/components/DiscoveryView";
import type { SP } from "@/lib/params";

export const dynamic = "force-dynamic";
export const metadata = { title: "Free website templates — Kurumera" };

export default async function FreeTemplatesPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <DiscoveryView params={await searchParams} forced={{ price: "free" }} />;
}

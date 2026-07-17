import { DiscoveryView } from "@/components/DiscoveryView";
import type { SP } from "@/lib/params";

export const dynamic = "force-dynamic";
export const metadata = { title: "Premium website templates — Kurumera" };

export default async function PaidTemplatesPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <DiscoveryView params={await searchParams} forced={{ price: "paid" }} />;
}

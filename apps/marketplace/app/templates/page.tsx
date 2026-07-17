import type { Metadata } from "next";
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
  return { title: `${title} — Kurumera Templates` };
}

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <DiscoveryView params={await searchParams} />;
}

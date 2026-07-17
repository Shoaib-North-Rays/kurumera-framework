import type { MetadataRoute } from "next";
import { fetchTemplates, CATEGORIES } from "@/lib/registry";

const BASE = "https://marketplace.kurumera.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const templates = await fetchTemplates().catch(() => []);
  const stat = ["", "/templates", "/templates/free", "/templates/paid", "/creator", "/privacy", "/terms"].map((p) => ({
    url: `${BASE}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7,
  }));
  const cats = CATEGORIES.map((c) => ({
    url: `${BASE}/templates/category/${c.key}`, changeFrequency: "weekly" as const, priority: 0.6,
  }));
  const tpls = templates.map((t) => ({
    url: `${BASE}/templates/${t.slug}`, changeFrequency: "weekly" as const, priority: 0.8,
  }));
  return [...stat, ...cats, ...tpls];
}

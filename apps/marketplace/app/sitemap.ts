import type { MetadataRoute } from "next";
import { fetchTemplates, CATEGORIES } from "@/lib/registry";

const BASE = "https://marketplace.kurumera.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /* THROWS on an outage, on purpose. `.catch(() => [])` published a valid 200
     sitemap containing zero template URLs whenever the registry was
     unreachable — which Google reads as "these pages are gone", not as "try
     again later". Failing the request outright makes the crawler retry. */
  const templates = await fetchTemplates();
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

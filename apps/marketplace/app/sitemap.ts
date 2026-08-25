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
  /* ONLY CATEGORIES THAT HAVE SOMETHING IN THEM. All twelve were submitted
     regardless, and six are empty — so half the sitemap pointed at pages whose
     entire content is "Nothing has been published under X yet." Asking a
     crawler to index thin pages spends crawl budget to earn a thin-content
     signal. They return as soon as a template lands in them, because this is
     computed from the live catalogue rather than a hand-kept list. */
  const populated = new Set(templates.map((t) => t.category).filter(Boolean));
  const cats = CATEGORIES.filter((c) => populated.has(c.key)).map((c) => ({
    url: `${BASE}/templates/category/${c.key}`, changeFrequency: "weekly" as const, priority: 0.6,
  }));
  const tpls = templates.map((t) => ({
    url: `${BASE}/templates/${t.slug}`, changeFrequency: "weekly" as const, priority: 0.8,
  }));
  return [...stat, ...cats, ...tpls];
}

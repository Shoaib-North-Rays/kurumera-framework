import type { MetadataRoute } from "next";
import { fetchTemplates, CATEGORIES } from "@/lib/registry";

const BASE = "https://marketplace.kurumera.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /* THROWS on an outage, on purpose. `.catch(() => [])` published a valid 200
     sitemap containing zero template URLs whenever the registry was
     unreachable — which Google reads as "these pages are gone", not as "try
     again later". Failing the request outright makes the crawler retry. */
  const templates = await fetchTemplates();
  // /creator is the signed-in dashboard — it gates to a sign-in prompt for a
  // crawler, so it is not a useful indexable URL and has been dropped. /sell is
  // the public creator page and belongs here in its place, alongside the guides
  // and the four legal documents, which are exactly the pages people search for
  // by name ("kurumera refund policy") and previously could not find.
  const stat = [
    "", "/templates", "/templates/free", "/templates/paid",
    "/sell", "/docs/creator-guide", "/docs/payouts", "/docs/taxes",
    "/terms", "/license", "/refunds", "/privacy",
  ].map((p) => ({
    url: `${BASE}${p}`,
    changeFrequency: "weekly" as const,
    // Legal and guide pages are real destinations but not the point of the
    // site; the discovery routes should outrank them.
    priority: p === "" ? 1 : p.startsWith("/templates") || p === "/sell" ? 0.7 : 0.4,
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

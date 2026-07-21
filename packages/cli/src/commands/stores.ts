import { readConfig } from "../util/config.js";

/**
 * `kurumera stores list` — the stores this machine is signed in to. Sourced from
 * the local config (`kurumera login` sets your default store; `login --store
 * <slug> --token ksf_…` adds per-store storefront tokens).
 */
export function storesList(): number {
  const cfg = readConfig();
  const rows: { slug: string; note: string }[] = [];
  if (cfg.defaultStore) rows.push({ slug: cfg.defaultStore, note: "default (from login)" });
  for (const slug of Object.keys(cfg.stores || {})) {
    if (slug === cfg.defaultStore) continue;
    rows.push({ slug, note: "storefront token" });
  }

  if (!rows.length) {
    console.log("No stores yet.");
    console.log("  Sign in:        kurumera login");
    console.log("  Or add a token: kurumera login --store <slug> --token ksf_…");
    return 0;
  }

  console.log("Your stores\n");
  for (const r of rows) console.log(`  ${r.slug.padEnd(24)} ${r.note}`);
  console.log("\nTarget any with --store <slug>; its storefront is <slug>.kurumera.com.");
  return 0;
}

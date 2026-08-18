"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SORTS } from "@/lib/registry";

/**
 * The only client component on the discovery surface, and only because a
 * <select> has no link equivalent.
 *
 * It stays route-agnostic: it pushes onto the CURRENT pathname, so sorting from
 * /templates/category/restaurant keeps you in the category — the same bug the
 * filter links had, which this one already avoided via usePathname.
 */
export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [pick, setPick] = useState<string | null>(null);
  const current = sp.get("sort") || (sp.get("q") ? "relevant" : "installs");
  // While the navigation is in flight the URL still says the OLD sort, and a
  // controlled <select> would be snapped back to it mid-transition. Hold the
  // chosen value locally until the server catches up, then drop back to the URL
  // — which stays the single source of truth for what is actually rendered.
  const value = pending && pick ? pick : current;

  return (
    <label className="sortsel" data-pending={pending ? "1" : undefined}>
      <span className="sr-only">Sort templates</span>
      <select
        value={value}
        aria-busy={pending || undefined}
        onChange={(e) => {
          setPick(e.target.value);
          const p = new URLSearchParams(sp.toString());
          p.set("sort", e.target.value);
          // Re-ordering invalidates the page window — page 3 of the old order
          // is not page 3 of the new one, so land the user back at the start.
          p.delete("page");
          const qs = p.toString();
          // A transition, so the select keeps showing the chosen value while the
          // server round-trip is in flight instead of snapping back to the old
          // one. `pending` drives the dimmed state in app/discovery.css — the
          // feedback that tells the user the click registered.
          start(() => router.push(qs ? `${pathname}?${qs}` : pathname));
        }}
      >
        {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
    </label>
  );
}

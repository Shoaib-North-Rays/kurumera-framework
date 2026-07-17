"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SORTS } from "@/lib/registry";

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get("sort") || (sp.get("q") ? "relevant" : "installs");
  return (
    <label className="sortsel">
      <span className="sr-only">Sort templates</span>
      <select
        value={current}
        onChange={(e) => {
          const p = new URLSearchParams(sp.toString());
          p.set("sort", e.target.value);
          router.push(`${pathname}?${p.toString()}`);
        }}
      >
        {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
    </label>
  );
}

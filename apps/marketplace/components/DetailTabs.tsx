"use client";

import { useState } from "react";
import type { Template } from "@/lib/registry";

/** Only honest tabs — no reviews/pages/updates (no data yet). */
export function DetailTabs({ t }: { t: Template }) {
  const [tab, setTab] = useState<"overview" | "details" | "versions">("overview");
  const tabs: [typeof tab, string][] = [["overview", "Overview"], ["details", "Details"], ["versions", `Versions (${t.versions.length || 1})`]];

  return (
    <div>
      <div className="tabs" role="tablist" aria-label="Template information">
        {tabs.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="tabpane">
          <p>{t.description || "A Kurumera code theme you can customise in the visual builder and publish to your own store."}</p>
          <p>Open it in the builder to edit every page, or clone the source to change it in code — either way you own your site and can publish to a custom domain.</p>
        </div>
      )}
      {tab === "details" && (
        <div className="tabpane">
          <ul style={{ paddingLeft: "1.2em", color: "var(--muted)", lineHeight: 1.9 }}>
            <li><b style={{ color: "var(--ink)" }}>Creator:</b> {t.author}</li>
            {t.category && <li><b style={{ color: "var(--ink)" }}>Category:</b> {t.category}</li>}
            {t.tags.length > 0 && <li><b style={{ color: "var(--ink)" }}>Tags:</b> {t.tags.join(", ")}</li>}
            <li><b style={{ color: "var(--ink)" }}>Current version:</b> {t.latest}</li>
            <li><b style={{ color: "var(--ink)" }}>Builder compatibility:</b> Kurumera visual builder + code themes</li>
          </ul>
        </div>
      )}
      {tab === "versions" && (
        <div className="versions">
          {(t.versions.length ? t.versions : [t.latest]).slice().reverse().map((v) => (
            <div key={v} className={`version ${v === t.latest ? "is-latest" : ""}`}>
              <span>v{v}</span>
              {v === t.latest && <span style={{ color: "var(--green-dark)", fontWeight: 600, fontSize: 12.5 }}>Latest</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

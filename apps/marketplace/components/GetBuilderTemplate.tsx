"use client";

import { useState } from "react";
import { Bolt, Expand, Cart } from "@/components/Icons";
import { builderPreviewUrl, BUILDER_ORIGIN } from "@/lib/registry";

/**
 * PDP "get" section for a builder template. Free → "Add to my site" opens the
 * builder's install flow (sign in → confirm → pages created). Paid → Stripe
 * checkout (Stripe collects the email; a license is issued on completion).
 */
export function GetBuilderTemplate({ slug, name, free, priceLabel }: { slug: string; name: string; free: boolean; priceLabel: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const installUrl = `${BUILDER_ORIGIN}/install/${encodeURIComponent(slug)}`;

  async function buy() {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/market/checkout`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: slug }),
      });
      const d = await r.json();
      if (d?.ok && d.url) { window.location.href = d.url; return; }
      setErr(d?.error || "Checkout is unavailable right now.");
    } catch { setErr("Checkout failed — please try again."); }
    setBusy(false);
  }

  return (
    <div className="pdp__actions">
      <div className="builder-note">
        <Bolt />
        <p><b>Editable visual template.</b> Add it to your site and customize it in the Kurumera builder — no code needed.</p>
      </div>
      {free ? (
        <a className="btn btn--primary btn--lg btn--block" href={installUrl}><Bolt /> Add to my site</a>
      ) : (
        <button className="btn btn--primary btn--lg btn--block" onClick={buy} disabled={busy}>
          <Cart /> {busy ? "Starting checkout…" : `Buy template — ${priceLabel}`}
        </button>
      )}
      {err && <p className="note" style={{ color: "#dc2626" }}>{err}</p>}
      <a className="btn btn--secondary btn--lg btn--block" href={builderPreviewUrl(slug)} target="_blank" rel="noreferrer"><Expand /> Live preview</a>
    </div>
  );
}

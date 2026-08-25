"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bolt, Expand, Cart, Shield } from "@/components/Icons";
import { getSession } from "@/lib/session";
import { builderPreviewUrl, BUILDER_ORIGIN } from "@/lib/registry";

/**
 * PDP "get" section for a builder template. Free → "Add to my site" opens the
 * builder's install flow (sign in → confirm → pages created). Paid → Stripe
 * checkout (Stripe collects the email; a license is issued on completion).
 */
export function GetBuilderTemplate({ slug, name, free, priceLabel }: { slug: string; name: string; free: boolean; priceLabel: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  /** See GetTemplate: only ever true on a positive server answer, so a failed
   *  lookup cannot hide Buy from someone who has not bought. */
  const [owned, setOwned] = useState<boolean | null>(null);
  const installUrl = `${BUILDER_ORIGIN}/install/${encodeURIComponent(slug)}`;

  useEffect(() => {
    if (free) return;
    const session = getSession();
    if (!session?.token) return;
    let live = true;
    fetch(`/api/market/purchases?store=${encodeURIComponent(session.tenant || "")}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d) return;
        const mine = Array.isArray(d.purchases) ? d.purchases : [];
        setOwned(mine.some((x: { theme?: string }) => String(x?.theme || "") === slug));
      })
      .catch(() => { /* fail open */ });
    return () => { live = false; };
  }, [slug, free]);

  async function buy() {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/market/checkout`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: slug }),
      });
      const d = await r.json();
      if (d?.ok && d.url) { window.location.href = d.url; return; }
      if (d?.owned) { setOwned(true); return; }
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
      ) : owned ? (
        <Link className="btn btn--primary btn--lg btn--block" href="/purchases"><Bolt /> You own this — view licence</Link>
      ) : (
        <button className="btn btn--primary btn--lg btn--block" onClick={buy} disabled={busy}>
          <Cart /> {busy ? "Starting checkout…" : `Buy template — ${priceLabel}`}
        </button>
      )}
      {err && <p className="note" style={{ color: "#dc2626" }}>{err}</p>}
      {/* This path sends the buyer straight to Stripe with no modal, so it had
          none of the reassurance the code-theme path shows — no mention of who
          takes the payment, and no word on which email the licence binds to.
          Stripe collects the address itself here, which is exactly why it needs
          saying: it will not necessarily be the account email. */}
      {!free && !owned && (
        <p className="note" style={{ marginTop: 2 }}>
          <Shield /> Secure checkout powered by Stripe. Your licence binds to the email you
          give Stripe — use your Kurumera account address so it appears in{" "}
          <Link href="/purchases" style={{ color: "var(--green-dark)", fontWeight: 600 }}>Your purchases</Link>.
        </p>
      )}
      <a className="btn btn--secondary btn--lg btn--block" href={builderPreviewUrl(slug)} target="_blank" rel="noreferrer"><Expand /> Live preview</a>
    </div>
  );
}

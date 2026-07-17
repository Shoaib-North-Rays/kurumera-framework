"use client";

import { useState } from "react";
import { MARKET_ORIGIN, previewUrl } from "@/lib/registry";
import { Cart, Bolt } from "@/components/Icons";

function Cmd({ label, cmd }: { label: string; cmd: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code">
      <div className="code__bar">
        <span>{label}</span>
        <button onClick={() => { navigator.clipboard?.writeText(cmd); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>{copied ? "copied" : "copy"}</button>
      </div>
      <pre><code><span className="p">$</span> {cmd}</code></pre>
    </div>
  );
}

/**
 * Use (free) reveals the working install/clone path; Buy (paid) runs the live
 * Stripe checkout (records ownership via a license). The full authenticated
 * workspace → create-site → install → builder wizard is Phase 2.
 */
export function GetTemplate({ slug, free, priceLabel }: { slug: string; free: boolean; priceLabel: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function buy() {
    const email = prompt("Enter your email for the receipt & license key:");
    if (email === null) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${MARKET_ORIGIN}/_push/market/checkout`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: slug, email }),
      });
      const d = await r.json();
      if (d?.ok && d.url) { window.location.href = d.url; return; }
      setErr(d?.error || "Checkout is unavailable right now.");
    } catch { setErr("Checkout failed — please try again."); }
    setBusy(false);
  }

  return (
    <div className="pdp__actions">
      {free ? (
        <button className="btn btn--primary btn--lg btn--block" onClick={() => setOpen((v) => !v)}><Bolt /> Use This Template</button>
      ) : (
        <button className="btn btn--primary btn--lg btn--block" onClick={buy} disabled={busy}><Cart /> {busy ? "Starting checkout…" : `Buy Template — ${priceLabel}`}</button>
      )}
      <a className="btn btn--secondary btn--lg btn--block" href={previewUrl(slug)} target="_blank" rel="noreferrer">Live Preview</a>
      {err && <p className="note" style={{ color: "var(--error)" }}>{err}</p>}

      {open && free && (
        <div className="getflow">
          <p className="note">Install it into your store, or clone the source to edit — a guided create-site flow is coming soon.</p>
          <Cmd label="install into a store" cmd={`kurumera marketplace install ${slug} --store <your-store>`} />
          <Cmd label="clone the source" cmd={`curl -sL "${MARKET_ORIGIN}/_push/market/source?theme=${slug}" | tar xz -C my-${slug}`} />
        </div>
      )}
    </div>
  );
}

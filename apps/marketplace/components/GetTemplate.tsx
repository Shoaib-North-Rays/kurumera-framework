"use client";

import { useState, useEffect, useRef } from "react";
import { MARKET_ORIGIN, previewUrl } from "@/lib/registry";
import { Cart, Bolt, Shield } from "@/components/Icons";

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
  const [open, setOpen] = useState(false);    // free: reveal install/clone commands
  const [modal, setModal] = useState(false);  // paid: email-capture checkout modal
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // While the modal is open: autofocus the field, close on Escape, lock body scroll.
  useEffect(() => {
    if (!modal) return;
    const focus = setTimeout(() => inputRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(focus);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal]);

  function openModal() { setErr(""); setEmail(""); setModal(true); }
  function closeModal() { if (busy) return; setModal(false); }

  async function submitBuy(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setErr("Please enter a valid email address.");
      inputRef.current?.focus();
      return;
    }
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/market/checkout`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: slug, email: value }),
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
        <button className="btn btn--primary btn--lg btn--block" onClick={openModal}><Cart /> Buy Template — {priceLabel}</button>
      )}
      <a className="btn btn--secondary btn--lg btn--block" href={previewUrl(slug)} target="_blank" rel="noreferrer">Live Preview</a>

      {open && free && (
        <div className="getflow">
          <p className="note">Install it into your store, or clone the source to edit — a guided create-site flow is coming soon.</p>
          <Cmd label="install into a store" cmd={`kurumera marketplace install ${slug} --store <your-store>`} />
          <Cmd label="clone the source" cmd={`curl -sL "${MARKET_ORIGIN}/_push/market/source?theme=${slug}" | tar xz -C my-${slug}`} />
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onMouseDown={closeModal} role="presentation">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="buy-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="modal__x" onClick={closeModal} aria-label="Close" type="button">×</button>
            <h3 id="buy-title" className="modal__title">Complete your purchase</h3>
            <p className="modal__sub">Enter your email — we&apos;ll send your receipt and license key after checkout.</p>
            <form onSubmit={submitBuy} noValidate>
              <input
                ref={inputRef}
                className="input"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (err) setErr(""); }}
                aria-label="Email address"
                aria-invalid={!!err}
              />
              {err && <p className="modal__err">{err}</p>}
              <div className="modal__actions">
                <button type="button" className="btn btn--secondary" onClick={closeModal} disabled={busy}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? "Starting checkout…" : `Continue — ${priceLabel}`}</button>
              </div>
            </form>
            <p className="modal__note"><Shield /> Secure checkout powered by Stripe</p>
          </div>
        </div>
      )}
    </div>
  );
}

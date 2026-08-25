"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { previewUrl } from "@/lib/registry";
import { getSession, startSignIn } from "@/lib/session";
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
  /** null = not asked yet (signed out, or still loading). Only ever true on a
   *  positive answer from the server, so a failed lookup can never hide the Buy
   *  button from someone who has not bought. */
  const [owned, setOwned] = useState<boolean | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // While the modal is open: autofocus the field, close on Escape, lock body scroll,
  // trap Tab within the dialog, and restore focus to the opener on close (a11y).
  useEffect(() => {
    if (!modal) return;
    const opener = document.activeElement as HTMLElement | null;
    const focus = setTimeout(() => inputRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { closeModal(); return; }
      if (e.key === "Tab" && dialogRef.current) {
        const els = dialogRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!els.length) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(focus);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal]);

  /**
   * ALREADY BOUGHT? Nothing stopped a buyer paying twice for the same template
   * — `createCheckout` never consults the licence store and the button always
   * read "Buy Template". At $300 that is a real, refundable mistake we were
   * inviting. Purchases are matched by account email server-side, so this asks
   * the same endpoint /purchases does rather than trusting anything local.
   *
   * Fails OPEN. A network error leaves `owned` null and the Buy button stands:
   * blocking a genuine sale because a lookup timed out is the worse failure.
   */
  useEffect(() => {
    if (free) return;
    const session = getSession();
    setSignedIn(!!session?.token);
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
      .catch(() => { /* leave null — see above */ });
    return () => { live = false; };
  }, [slug, free]);

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
      ) : owned ? (
        <Link className="btn btn--primary btn--lg btn--block" href="/purchases"><Bolt /> You own this — view licence</Link>
      ) : (
        <button className="btn btn--primary btn--lg btn--block" onClick={openModal}><Cart /> Buy Template — {priceLabel}</button>
      )}
      <a className="btn btn--secondary btn--lg btn--block" href={previewUrl(slug)} target="_blank" rel="noreferrer">Live Preview</a>

      {open && free && (
        <div className="getflow">
          <p className="note">Install it into your store to go live, or clone the source to customize the code.</p>
          <Cmd label="install into a store (go live)" cmd={`kurumera marketplace install ${slug} --store <your-store>`} />
          <Cmd label="clone the source (customize)" cmd={`kurumera marketplace clone ${slug}`} />
          <p className="note">Then <code>npm install</code>, edit, and <code>kurumera theme push</code> to ship your version. <a href="https://themekit.kurumera.com/guide" target="_blank" rel="noreferrer" style={{ color: "var(--green-dark)" }}>Full guide →</a></p>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onMouseDown={closeModal} role="presentation">
          <div
            ref={dialogRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="buy-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="modal__x" onClick={closeModal} aria-label="Close" type="button">×</button>
            <h3 id="buy-title" className="modal__title">Complete your purchase</h3>
            {/* WHICH EMAIL, SAID OUT LOUD. The licence binds to whatever is typed
                here, but "Your purchases" is matched on the VERIFIED account
                email — so a typo, or a work address when the account is a
                personal one, made the purchase permanently invisible with no
                way to reconcile it. Saying so is not a fix for the mismatch,
                but it is the difference between a buyer making an informed
                choice and one silently losing $300. */}
            <p className="modal__sub">
              Your licence binds to this email, and <b>Your purchases</b> is matched on it —
              so use the address on your Kurumera account.
            </p>
            {!signedIn && (
              <p className="modal__sub" style={{ marginTop: -6 }}>
                <button
                  type="button"
                  onClick={() => startSignIn(`/templates/${slug}`)}
                  style={{ background: "none", border: 0, padding: 0, font: "inherit", color: "var(--green-dark)", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                >
                  Sign in first
                </button>{" "}
                and we can match it for you.
              </p>
            )}
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

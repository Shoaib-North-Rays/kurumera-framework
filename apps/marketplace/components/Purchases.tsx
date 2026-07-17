"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getSession, startSignIn, type Session } from "@/lib/session";
import { Bolt } from "@/components/Icons";

function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code">
      <div className="code__bar">
        <span>{label}</span>
        <button onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>{copied ? "copied" : "copy"}</button>
      </div>
      <pre><code>{value}</code></pre>
    </div>
  );
}

interface Purchase { theme: string; name: string; key: string; created: number }

export function Purchases() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [items, setItems] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { setSession(getSession()); setReady(true); }, []);

  const load = useCallback(async (token: string, store: string) => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/market/purchases?store=${encodeURIComponent(store)}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) { setError(d?.error || "Couldn't load your purchases."); setLoading(false); return; }
      setItems(d.purchases || []); setLoading(false);
    } catch { setError("Network error — please try again."); setLoading(false); }
  }, []);

  useEffect(() => {
    if (session?.token && session.tenant) load(session.token, session.tenant);
    else setLoading(false);
  }, [session, load]);

  if (!ready) return null;

  if (!session) {
    return (
      <div className="connect" style={{ textAlign: "center" }}>
        <h2>Sign in to see your purchases</h2>
        <p>Sign in with your Kurumera account to view the templates you&rsquo;ve bought and re-download your license keys anytime.</p>
        <button className="btn btn--primary btn--lg btn--block" onClick={() => startSignIn("/purchases")}><Bolt /> Sign in with Kurumera</button>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ paddingTop: 24 }}>
      <h1 className="purchases__title">Your purchases</h1>
      <p className="muted">Templates bought with your account email — lost a key? It&rsquo;s always here.</p>
      {loading && <p className="muted" style={{ padding: "20px 0" }}>Loading…</p>}
      {error && <p className="err">{error}</p>}
      {!loading && !items.length && !error && (
        <p className="muted" style={{ padding: "24px 0" }}>No purchases yet under this account. <Link href="/templates/paid">Browse premium templates →</Link></p>
      )}
      <div className="purchases__list">
        {items.map((it) => (
          <div className="pcard" key={it.key}>
            <div className="pcard__top">
              <b>{it.name}</b>
              <Link href={`/templates/${it.theme}`} className="pcard__link">View template →</Link>
            </div>
            <CopyBox label="license key" value={it.key} />
            <CopyBox label="install into a store" value={`kurumera marketplace install ${it.theme} --store <your-store> --license ${it.key}`} />
            <CopyBox label="clone to customize" value={`kurumera marketplace clone ${it.theme} --license ${it.key}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

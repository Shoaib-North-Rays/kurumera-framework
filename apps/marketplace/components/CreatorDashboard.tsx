"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getSession, signOut, startSignIn, type Session } from "@/lib/session";
import { LivePreview } from "@/components/LivePreview";
import { CATEGORIES } from "@/lib/registry";
import { Check, Bolt } from "@/components/Icons";

// Must mirror the push-service currency whitelist (bogus codes break checkout).
const CURRENCIES = ["USD", "EUR", "GBP", "PKR", "INR", "AED", "SAR", "AUD", "CAD", "SGD", "JPY", "KRW"];

interface CTheme { slug: string; name: string; description: string; price: number; currency: string; tags: string[]; category: string; installs: number; latest: string }

export function CreatorDashboard() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [themes, setThemes] = useState<CTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { setSession(getSession()); setReady(true); }, []);

  const load = useCallback(async (token: string, store: string) => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/market/mine?store=${encodeURIComponent(store)}`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) { setError(d?.error || "Couldn't load your templates."); setLoading(false); return; }
      setThemes(d.themes || []); setLoading(false);
    } catch { setError("Network error — please try again."); setLoading(false); }
  }, []);

  useEffect(() => {
    if (session?.token && session.tenant) load(session.token, session.tenant);
    else setLoading(false);
  }, [session, load]);

  if (!ready) return null; // avoid a hydration flash of the signed-out state

  if (!session) {
    return (
      <div className="connect" style={{ textAlign: "center" }}>
        <h2>Sign in to manage your templates</h2>
        <p>Sign in with your Kurumera account to edit pricing, descriptions and tags for the templates you&rsquo;ve published.</p>
        <button className="btn btn--primary btn--lg btn--block" onClick={() => startSignIn("/creator")}><Bolt /> Sign in with Kurumera</button>
      </div>
    );
  }

  const store = session.tenant;
  return (
    <>
      <div className="wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 20, gap: 12, flexWrap: "wrap" }}>
        <span className="muted" style={{ fontSize: 14 }}>Signed in{store ? <> — store <b style={{ color: "var(--ink)" }}>{store}</b></> : ""}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/purchases" className="btn btn--tertiary">My purchases</Link>
          <button className="btn btn--tertiary" onClick={() => { signOut(); setSession(null); setThemes([]); }}>Sign out</button>
        </div>
      </div>
      <div className="wrap">
        {loading && <p className="muted" style={{ padding: "20px 0" }}>Loading your templates…</p>}
        {error && <p className="err">{error}</p>}
        {!loading && !themes.length && !error && (
          <p className="muted" style={{ padding: "30px 0" }}>
            No templates published from <b>{store || "your store"}</b> yet. Publish one with <code>kurumera marketplace publish --store {store || "<your-store>"}</code>.
          </p>
        )}
        <div className="creator-list">
          {themes.map((t) => (
            <ThemeRow
              key={t.slug}
              theme={t}
              token={session.token}
              store={store}
              onRemove={() => setThemes((prev) => prev.filter((x) => x.slug !== t.slug))}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function ThemeRow({ theme, token, store, onRemove }: { theme: CTheme; token: string; store: string; onRemove: () => void }) {
  const [price, setPrice] = useState(String(theme.price || 0));
  const [currency, setCurrency] = useState(theme.currency || "USD");
  const [category, setCategory] = useState(theme.category || "");
  const [description, setDescription] = useState(theme.description || "");
  const [tags, setTags] = useState((theme.tags || []).join(", "));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [removing, setRemoving] = useState(false);

  async function save() {
    setState("saving"); setMsg("");
    try {
      const r = await fetch(`/api/market/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          store, theme: theme.slug,
          price: Number(price) || 0, currency, category,
          description,
          tags: tags.split(",").map((x) => x.trim()).filter(Boolean),
        }),
      });
      const d = await r.json();
      if (!r.ok || d?.ok === false) { setState("error"); setMsg(d?.error || "Save failed."); return; }
      setState("saved"); setTimeout(() => setState("idle"), 2200);
    } catch { setState("error"); setMsg("Network error."); }
  }

  async function unpublish() {
    if (!window.confirm(`Delist "${theme.name}" from the marketplace? Existing installs keep working; new shoppers won't see it. You can re-publish anytime.`)) return;
    setRemoving(true); setMsg("");
    try {
      const r = await fetch(`/api/market/unpublish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ store, theme: theme.slug }),
      });
      const d = await r.json();
      if (!r.ok || d?.ok === false) { setRemoving(false); setState("error"); setMsg(d?.error || "Delist failed."); return; }
      onRemove();
    } catch { setRemoving(false); setState("error"); setMsg("Network error."); }
  }

  return (
    <div className="crow">
      <div className="crow__media"><LivePreview slug={theme.slug} name={theme.name} /></div>
      <div className="crow__body">
        <div className="crow__top">
          <div>
            <div className="crow__name">{theme.name}</div>
            <div className="crow__stat">{theme.slug} · v{theme.latest}</div>
          </div>
          <div className="crow__stat"><b>{theme.installs.toLocaleString()}</b> installs</div>
        </div>

        <div className="crow__form">
          <div className="field">
            <label htmlFor={`p-${theme.slug}`}>Price (0 = free)</label>
            <input id={`p-${theme.slug}`} className="input" type="number" min={0} max={999999} step="1" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`c-${theme.slug}`}>Currency</label>
            <select id={`c-${theme.slug}`} className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`cat-${theme.slug}`}>Category</label>
            <select id={`cat-${theme.slug}`} className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">— none —</option>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`t-${theme.slug}`}>Tags (comma-separated)</label>
            <input id={`t-${theme.slug}`} className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ecommerce, modern, dark" />
          </div>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor={`d-${theme.slug}`}>Description</label>
          <textarea id={`d-${theme.slug}`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} placeholder="One-line description shown on the listing…" />
        </div>

        <div className="crow__row2">
          <span>{state === "error" ? <span className="err">{msg}</span> : state === "saved" ? <span className="crow__saved"><Check width={15} height={15} /> Saved — live on the marketplace</span> : <span className="crow__stat">Edits go live on the marketplace immediately.</span>}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn--danger" onClick={unpublish} disabled={removing || state === "saving"}>{removing ? "Delisting…" : "Delist"}</button>
            <button className="btn btn--primary" onClick={save} disabled={state === "saving" || removing}>{state === "saving" ? "Saving…" : "Save changes"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

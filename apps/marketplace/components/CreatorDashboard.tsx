"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getSession, signOut, startSignIn, type Session } from "@/lib/session";
import { LivePreview } from "@/components/LivePreview";
import { CATEGORIES, BUILDER_ORIGIN } from "@/lib/registry";
import { Check, Bolt, Arrow } from "@/components/Icons";

// Must mirror the push-service currency whitelist (bogus codes break checkout).
const CURRENCIES = ["USD", "EUR", "GBP", "PKR", "INR", "AED", "SAR", "AUD", "CAD", "SGD", "JPY", "KRW"];

interface CTheme { slug: string; name: string; description: string; price: number; currency: string; tags: string[]; category: string; installs: number; latest: string; coverImage?: string;
  /** The store this listing was PUBLISHED FROM. Edits authorize against this,
   *  not against whichever store the session happens to be on. */
  sourceStore: string }

export function CreatorDashboard() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [themes, setThemes] = useState<CTheme[]>([]);
  const [stores, setStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { setSession(getSession()); setReady(true); }, []);

  /* NO STORE. A creator is a person, and their listings are spread across every
     store they have ever published from — nine live listings currently come from
     nine different stores. Scoping this to session.tenant meant a creator signed
     into any other store was told "no templates published yet", which is true of
     that store and false of them. */
  const load = useCallback(async (token: string) => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/market/mine`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) { setError(d?.error || "Couldn't load your templates."); setLoading(false); return; }
      setThemes(d.themes || []); setStores(d.stores || []); setLoading(false);
    } catch { setError("Network error — please try again."); setLoading(false); }
  }, []);

  useEffect(() => {
    // A token is enough to ask. Requiring session.tenant meant a creator whose
    // session carried no store never issued the request at all.
    if (session?.token) load(session.token);
    else setLoading(false);
  }, [session, load]);

  if (!ready) return null; // avoid a hydration flash of the signed-out state

  if (!session) {
    /* A lone centred card in 500px of empty grey was the most template-like
       screen on the site. It is now a composed two-column gate: what the
       dashboard is for on the left, the one control on the right. Every line
       on the left states something the platform actually does — nothing here
       claims an audience, a payout figure or a creator count. */
    return (
      <div className="wrap cgate">
        <div className="cgate__pitch">
          <h2 className="cgate__h">Your templates,<br />your terms.</h2>
          <ul className="cgate__list">
            <li>Set your own price — free, or paid from any amount.</li>
            <li>Edit pricing, descriptions and tags whenever you like; changes reach the marketplace within a minute.</li>
            <li>Keep ownership of your work. Kurumera lists it under the platform&rsquo;s terms.</li>
            <li>Publish from the visual builder or as a Next.js code theme.</li>
          </ul>
        </div>
        <div className="cgate__panel">
          <h3>Sign in to manage your templates</h3>
          <p>Use your Kurumera account — the same one you build with.</p>
          <button className="btn btn--primary btn--lg btn--block" onClick={() => startSignIn("/creator")}><Bolt /> Sign in with Kurumera</button>
          <p className="cgate__foot">No account yet? Publishing starts in the builder.</p>
        </div>
      </div>
    );
  }

  const store = session.tenant;
  return (
    <>
      <div className="wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 20, gap: 12, flexWrap: "wrap" }}>
        {/* Was "store <slug>", which read as the SCOPE of the page. It is not:
            this lists everything you have published, from every store you
            staff. Stating how many stores that spans is true; naming one was
            not — and naming the wrong one is what made a creator with listings
            elsewhere see an empty page. */}
        <span className="muted" style={{ fontSize: 14 }}>
          Signed in
          {stores.length > 1 ? <> — {stores.length} stores</> : stores.length === 1 ? <> — store <b style={{ color: "var(--ink)" }}>{stores[0]}</b></> : ""}
        </span>
        {/* flexWrap: the outer row wraps but this group did not, so three
            buttons stayed on one 352px line and pushed the PAGE sideways at
            360px. Pre-existing; visible on any small phone. */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* EARNINGS WERE UNREACHABLE FROM HERE. A creator manages listings on
              this page, but their sales, their balance after the platform fee
              and their payout account all live in the builder app — and nothing
              on the marketplace linked to it. There was no path from "I sell
              templates here" to "here is what I have earned". */}
          <a href={`${BUILDER_ORIGIN}/earnings`} className="btn btn--tertiary">Earnings &amp; payouts</a>
          <Link href="/purchases" className="btn btn--tertiary">My purchases</Link>
          <button className="btn btn--tertiary" onClick={() => { signOut(); setSession(null); setThemes([]); setStores([]); }}>Sign out</button>
        </div>
      </div>
      <div className="wrap">
        {loading && <p className="muted" style={{ padding: "20px 0" }}>Loading your templates…</p>}
        {error && <p className="err">{error}</p>}
        {!loading && !themes.length && !error && (
          <p className="muted" style={{ padding: "30px 0" }}>
            You haven&rsquo;t published any templates yet. Publish one with{" "}
            <code>kurumera marketplace publish --store {store || "<your-store>"}</code>.
          </p>
        )}
        <div className="creator-list">
          {themes.map((t) => (
            <ThemeRow
              key={t.slug}
              theme={t}
              token={session.token}
              store={t.sourceStore || store}
              onRemove={() => setThemes((prev) => prev.filter((x) => x.slug !== t.slug))}
            />
          ))}
        </div>
      </div>
    </>
  );
}


/**
 * Builder designs are versioned by epoch-millisecond stamp, so this card was
 * showing creators "v1787058242903" and calling it a version. Nobody can read
 * that, and it is not a number they chose. A code theme's semver ("1.0.7") is
 * meaningful, so it is left alone — only the timestamp is turned back into the
 * date it actually is.
 */
function versionLabel(latest: string): string {
  const v = String(latest || "").trim();
  if (!v) return "no version yet";
  if (/^\d{12,}$/.test(v)) {
    const d = new Date(Number(v));
    if (!Number.isNaN(d.getTime())) {
      return `published ${d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
    }
  }
  return `v${v}`;
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
      <div className="crow__body">
        <div className="crow__top">
          {/* The cover sits IN the header at its own 64:45 shape, not as a
              full-height column. A landscape screenshot cannot fill a tall
              narrow column without cropping to an unrecognisable slice — and
              leaving the column at its natural aspect left a block of dead grey
              beside a five-field form, which is what made this page look
              unfinished. As a header thumbnail it is legible, and the form gets
              the whole width back.

              LivePreview remains the fallback for listings published before
              covers were captured; it is no longer the default, because it
              scales a live 1280px render of the page into a thumbnail and wakes
              a container per card to do it. */}
          <div className="crow__thumb">
            {theme.coverImage
              ? /* eslint-disable-next-line @next/next/no-img-element */
                <img src={theme.coverImage} alt="" loading="lazy" />
              : <LivePreview slug={theme.slug} name={theme.name} />}
          </div>
          <div className="crow__ident">
            <div className="crow__name">{theme.name}</div>
            <div className="crow__meta">
              <code>{theme.slug}</code>
              <span aria-hidden>·</span>
              <span>{versionLabel(theme.latest)}</span>
            </div>
          </div>
          <div className="crow__facts">
            {/* "1 installs" was on screen. Small, but it is the kind of thing a
                creator reads as nobody having looked at this page. */}
            <span className="crow__stat">
              <b>{theme.installs.toLocaleString()}</b>{" "}
              {theme.installs === 1 ? "install" : "installs"}
            </span>
            {/* There was no way to see the listing as a buyer sees it — the one
                thing a creator most wants after changing a price or a cover. */}
            <a className="crow__view" href={`/templates/${theme.slug}`} target="_blank" rel="noreferrer">
              View listing <Arrow />
            </a>
          </div>
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
          <div className="field field--wide">
            <label htmlFor={`t-${theme.slug}`}>Tags</label>
            <input id={`t-${theme.slug}`} className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ecommerce, modern, dark" />
            <span className="hint">Comma-separated. Three to five honest ones beat a long list.</span>
          </div>

          <div className="field field--wide">
            <label htmlFor={`d-${theme.slug}`}>Description</label>
            <textarea id={`d-${theme.slug}`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} placeholder="One-line description shown on the listing…" />
            {/* 400 is enforced by maxLength and was invisible until you hit it. */}
            <span className="hint">{description.length}/400</span>
          </div>
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

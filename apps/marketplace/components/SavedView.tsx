"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SaveButton } from "@/components/SaveButton";
import { isFree, priceLabel, normalize, type Template, authorLabel } from "@/lib/registry";

const KEY = "kurumera_saved";
function readSaved(): string[] { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }

export function SavedView() {
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Template[]>([]);
  /** Saved slugs exist but we could not fetch their details. Distinct from
   *  "nothing saved", which is what this used to claim in the same situation. */
  const [failed, setFailed] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    const slugs = new Set(readSaved());
    setSavedCount(slugs.size);
    if (!slugs.size) { setReady(true); return; }
    (async () => {
      try {
        const r = await fetch("/api/market/list");
        if (!r.ok) throw new Error(`list ${r.status}`);
        const d = await r.json();
        /* NORMALISE. This cast the raw relay payload straight to Template[] and
           then read `t.installs.toLocaleString()` and `authorLabel(t.author)`
           off it — so one missing field from the registry was a TypeError, and
           with no error boundary that was a blank page. The same normaliser the
           rest of the app uses fills every field with a typed default. */
        const all: Template[] = (Array.isArray(d?.themes) ? d.themes : []).map(normalize);
        setItems(all.filter((t) => slugs.has(t.slug)));
      } catch (e) {
        /* NOT "ignore". Swallowing this rendered "Nothing saved yet. Tap the
           heart on any template" to someone with ten saved templates — telling
           them their data was gone when it was sitting intact in localStorage
           two feet away. */
        console.error("[saved] could not load template details", e);
        setFailed(true);
      }
      setReady(true);
    })();
  }, []);

  // Re-read on save/unsave from within this view.
  const refresh = () => {
    const slugs = new Set(readSaved());
    setItems((prev) => prev.filter((t) => slugs.has(t.slug)));
  };

  if (!ready) return <div className="wrap"><p className="muted" style={{ padding: "40px 0" }}>Loading…</p></div>;

  return (
    <div className="wrap" style={{ paddingTop: 24, paddingBottom: "var(--sec-md)" }}>
      <h1 className="purchases__title">Saved templates</h1>
      <p className="muted">Templates you&rsquo;ve hearted — stored on this device.</p>
      {failed ? (
        <p className="muted" style={{ padding: "24px 0" }}>
          You have <b>{savedCount}</b> saved {savedCount === 1 ? "template" : "templates"}, but we
          couldn&rsquo;t load their details just now. They are still saved — please refresh in a moment.
        </p>
      ) : !items.length ? (
        <p className="muted" style={{ padding: "24px 0" }}>
          Nothing saved yet. Tap the heart on any template to keep it here. <Link href="/templates">Browse templates →</Link>
        </p>
      ) : (
        <div className="tpl-grid tpl-grid--4" style={{ marginTop: 20 }}>
          {items.map((t) => (
            <div className="tpl-card" key={t.slug}>
              <div className="tpl-card__media">
                <span onClick={refresh}><SaveButton slug={t.slug} /></span>
                <div className="frame">
                  {t.coverImage
                    ? <img className="frame__img" src={t.coverImage} alt={`${t.name} preview`} loading="lazy" />
                    : <span className="frame__ph" aria-hidden="true">{t.name.slice(0, 1).toUpperCase()}</span>}
                </div>
              </div>
              <Link href={`/templates/${t.slug}`} className="tpl-card__body">
                <h3 className="tpl-card__name">{t.name}</h3>
                <span className="tpl-card__creator">by {authorLabel(t.author)}</span>
                <div className="tpl-card__foot">
                  <span className="tpl-card__meta">{t.installs.toLocaleString()} installs</span>
                  <span className={`tpl-card__price ${isFree(t) ? "free" : ""}`}>{priceLabel(t)}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Stars, RatingBars } from "@/components/Stars";
import { getSession } from "@/lib/session";
import { EMPTY_RATING, type Rating } from "@/lib/registry";

/**
 * Ratings and reviews for one template.
 *
 * ONLY VERIFIED OWNERS CAN POST. The server requires either a valid, unrevoked
 * license key for this template or a signed-in store that has it installed;
 * this component just reflects that. There is no anonymous review box, because
 * an open one collects competitor noise and seller self-promotion and every
 * shopper knows it — "verified" is the only thing that makes a rating worth
 * reading.
 *
 * The consequence is that the numbers start small and grow slowly. Eight
 * listings and four installs exist today. That is the honest starting point:
 * a real 5.0 from two owners is worth more than an invented 4.9 from 1,200.
 */

type Review = {
  id: string; rating: number; title: string; body: string;
  at: number; verified: boolean; by: string;
};

/* Same-origin relays, like every other market call in this app — the browser
   never talks to themekit directly, so there is no CORS surface to configure
   and no second origin in the CSP. */
const fmtDate = (ms: number) =>
  ms ? new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";

export function Reviews({ slug, initial }: { slug: string; initial?: Rating }) {
  const [rating, setRating] = useState<Rating>(initial || EMPTY_RATING);
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [license, setLicense] = useState("");
  const [stars, setStars] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [writing, setWriting] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/market/reviews?theme=${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (!r.ok) { setReviews([]); return; }
      const d = await r.json();
      setReviews(Array.isArray(d.reviews) ? d.reviews : []);
      setRating({
        count: Number(d.count) || 0,
        average: Number(d.average) || 0,
        distribution: Array.isArray(d.distribution) ? d.distribution : EMPTY_RATING.distribution,
      });
    } catch {
      // The page is still useful without this. Never block the listing on it.
      setReviews([]);
    }
  }, [slug]);

  useEffect(() => { setSession(getSession()); load(); }, [load]);

  const submit = useCallback(async () => {
    if (!(stars >= 1 && stars <= 5)) { setMsg({ kind: "err", text: "Pick a rating from 1 to 5." }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/market/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: JSON.stringify({
          theme: slug, rating: stars, title, body,
          license: license.trim() || undefined,
          store: session?.tenant || undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg({ kind: "err", text: d.detail || d.error || "Could not save that review." });
      } else {
        setMsg({ kind: "ok", text: d.edited ? "Your review was updated." : "Thanks — your review is live." });
        setWriting(false); setTitle(""); setBody("");
        await load();
      }
    } catch {
      setMsg({ kind: "err", text: "Network error — please try again." });
    } finally {
      setBusy(false);
    }
  }, [slug, stars, title, body, license, session, load]);

  /* Either path MIGHT work, and only the server can say which. Enabling on
     "signed in OR key present" and letting the 403 explain itself beats
     disabling a button for a reason the client is guessing at. */
  const canTry = !!session || license.trim().length > 0;

  return (
    <section className="rv" aria-labelledby="rv-h">
      <div className="rv__head">
        <h2 id="rv-h" className="rv__title">Ratings</h2>
        {!writing && (
          <button type="button" className="btn btn--secondary rv__write" onClick={() => setWriting(true)}>
            Write a review
          </button>
        )}
      </div>

      {rating.count > 0 ? (
        <div className="rv__summary">
          <div className="rv__score">
            <span className="rv__avg">{rating.average.toFixed(1)}</span>
            <Stars rating={rating} size={18} showCount={false} />
            <span className="rv__from">
              {rating.count} verified {rating.count === 1 ? "owner" : "owners"}
            </span>
          </div>
          <RatingBars rating={rating} />
        </div>
      ) : (
        /* Not "0.0 ★★★★★". An unrated template must not look like a badly
           rated one — see Stars. */
        <p className="rv__none">
          No ratings yet. Only people who own this template can rate it, so the
          first review will come from someone who has actually used it.
        </p>
      )}

      {writing && (
        <form
          className="rv__form"
          onSubmit={(e) => { e.preventDefault(); submit(); }}
        >
          <fieldset className="rv__stars" disabled={busy}>
            <legend>Your rating</legend>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`rv__star${n <= stars ? " is-on" : ""}`}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                aria-pressed={n === stars}
                onClick={() => setStars(n)}
              >
                ★
              </button>
            ))}
          </fieldset>

          <label className="rv__label">
            Headline <span>optional</span>
            <input
              className="rv__input" value={title} maxLength={80} disabled={busy}
              onChange={(e) => setTitle(e.target.value)} placeholder="Worth the money"
            />
          </label>

          <label className="rv__label">
            Your review <span>optional</span>
            <textarea
              className="rv__input rv__textarea" value={body} maxLength={1200} rows={4} disabled={busy}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What was it like to install and customize?"
            />
          </label>

          {/* ALWAYS SHOWN. This used to be hidden whenever a session existed,
              on the assumption that a signed-in user must have installed the
              template into their store. Buying and installing are different
              things: the store path checks installs.json, so someone who had
              PURCHASED a template but not yet installed it was refused — with
              the only control that could have proved ownership hidden from
              them. A signed-in buyer had no way through at all. */}
          <label className="rv__label">
            License key {session && <span>if you bought it but have not installed it yet</span>}
            <input
              className="rv__input" value={license} disabled={busy}
              onChange={(e) => setLicense(e.target.value)} placeholder="KUR-…"
              autoComplete="off" spellCheck={false}
            />
            <span className="rv__hint">
              It is on your <a href="/purchases">purchases</a> page. Leave this blank if the
              template is already installed into the store you are signed in to.
            </span>
          </label>

          <div className="rv__actions">
            <button className="btn btn--primary" type="submit" disabled={busy || !canTry}>
              {busy ? "Saving…" : "Post review"}
            </button>
            <button className="btn btn--tertiary" type="button" disabled={busy} onClick={() => { setWriting(false); setMsg(null); }}>
              Cancel
            </button>
          </div>
          {!canTry && (
            <p className="rv__hint">
              Sign in, or paste the license key from your purchase, to post.
            </p>
          )}
        </form>
      )}

      {msg && <p className={`rv__msg rv__msg--${msg.kind}`} role="status">{msg.text}</p>}

      {reviews && reviews.length > 0 && (
        <ul className="rv__list">
          {reviews.map((r) => (
            <li key={r.id + r.at} className="rv__item">
              <div className="rv__itemhead">
                <Stars rating={{ count: 1, average: r.rating, distribution: EMPTY_RATING.distribution }} size={13} showCount={false} />
                {r.verified && <span className="rv__badge">Verified owner</span>}
                <span className="rv__date">{fmtDate(r.at)}</span>
              </div>
              {r.title && <p className="rv__itemtitle">{r.title}</p>}
              {r.body && <p className="rv__itembody">{r.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

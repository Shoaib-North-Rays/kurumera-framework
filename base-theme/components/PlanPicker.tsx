"use client";

import { useState, type FormEvent } from "react";
import { createKurumeraClient } from "@kurumera/storefront";
import type { SubscriptionPeriod, SubscriptionPlan, SubscriptionPrice } from "@kurumera/storefront";
import { tenantSlug } from "@/lib/cart-client";

/**
 * Plan cards with a month / year switch. Subscribing asks for an email, then
 * sends the shopper to the store's own Stripe checkout.
 *
 * Checkout starts from the browser, like the cart: the return links are built
 * from the address the shopper is actually on (custom domain, www or not), and
 * the platform sees the shopper's own connection. The theme holds no key — the
 * platform creates the Stripe session with the store's.
 *
 * A refusal ("already subscribed", "not taking new subscribers", a throttle)
 * comes back as a sentence written for the shopper; it is shown as it is.
 */
export function PlanPicker({ plans, accepting }: { plans: SubscriptionPlan[]; accepting: boolean }) {
  const hasMonth = plans.some((p) => p.prices.month);
  const hasYear = plans.some((p) => p.prices.year);
  const [period, setPeriod] = useState<SubscriptionPeriod>(hasMonth ? "month" : "year");
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <div className="plans__body">
      {hasMonth && hasYear ? (
        <div className="plans__period" role="group" aria-label="Billing period">
          {(["month", "year"] as const).map((p) => (
            <button key={p} type="button" aria-pressed={period === p}
              onClick={() => { setPeriod(p); setChosen(null); }}>
              {p === "month" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="plans__grid">
        {plans.map((plan) => {
          const price = plan.prices[period];
          return (
            <article key={plan.id} className="plan">
              <h2 className="plan__name">{plan.name}</h2>
              {plan.description ? <p className="plan__desc muted">{plan.description}</p> : null}
              {price ? (
                <p className="plan__price">
                  <span className="plan__amount">{formatPrice(price)}</span>
                  <span className="muted"> / {period}</span>
                </p>
              ) : (
                <p className="plan__price muted">Not offered {period === "month" ? "monthly" : "yearly"}</p>
              )}
              {plan.trial_days > 0 ? <p className="plan__trial">{plan.trial_days}-day free trial</p> : null}
              {plan.features.length ? (
                <ul className="plan__features">
                  {plan.features.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              ) : null}
              {chosen === plan.handle && price ? (
                <SubscribeForm plan={plan.handle} period={period} />
              ) : (
                <button type="button" className="btn btn--primary btn--block"
                  disabled={!accepting || !price} onClick={() => setChosen(plan.handle)}>
                  Subscribe
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function SubscribeForm({ plan, period }: { plan: string; period: SubscriptionPeriod }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ text: string; url: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    // Stripe only returns shoppers to https addresses on the store's own site;
    // on a local http preview the platform's own default is used instead.
    const origin = window.location.protocol === "https:" ? window.location.origin : "";
    let answer;
    try {
      answer = await createKurumeraClient({ tenant: tenantSlug() }).subscriptions.checkout({
        plan, period, email,
        ...(origin ? { successUrl: `${origin}/plans?subscribed=1`, cancelUrl: `${origin}/plans` } : {}),
      });
    } catch {
      // checkout() answers refusals itself; reaching here means the page has no
      // store to ask (no tenant resolved). Never leave the button spinning.
      setBusy(false);
      setError("We couldn't start the payment. Please refresh the page and try again.");
      return;
    }
    setBusy(false);
    if (!answer.ok) { setError(answer.detail); return; }
    // A trial this email already used: say so BEFORE the shopper pays.
    if (answer.notice) { setNotice({ text: answer.notice, url: answer.url }); return; }
    window.location.assign(answer.url);
  }

  if (notice) {
    return (
      <div className="plan__form">
        <p className="plan__message" role="status">{notice.text}</p>
        <a className="btn btn--primary btn--block" href={notice.url}>Continue to payment</a>
      </div>
    );
  }
  return (
    <form className="plan__form" onSubmit={submit}>
      <label className="plan__label">
        <span>Email</span>
        <input type="email" required autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </label>
      {error ? <p className="plan__message plan__message--error" role="alert">{error}</p> : null}
      <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
        {busy ? "Starting checkout…" : "Continue to payment"}
      </button>
    </form>
  );
}

/** "29.99" USD → "$29.99" in the shopper's own number format. */
function formatPrice(p: SubscriptionPrice): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: p.currency }).format(Number(p.amount));
  } catch {
    return `${p.amount} ${p.currency}`;
  }
}

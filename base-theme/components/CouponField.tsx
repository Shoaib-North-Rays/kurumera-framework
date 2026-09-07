"use client";

/**
 * Discount code entry on the cart.
 *
 * Until now a code could only be checked when the order was placed — so a
 * shopper typed one in, got nothing back, and learned it had expired after
 * filling in an address and a card. This answers immediately.
 *
 * Two things it deliberately does not do:
 *
 *   * It does not apply the discount locally. The saving shown is the one the
 *     SERVER calculated for this cart total, and the order endpoint re-checks
 *     the code against its own cart when the order is placed. A total computed
 *     in the browser is a number a shopper can edit.
 *   * It does not validate as you type. The endpoint is throttled at 20/hour
 *     per IP precisely because "is this code real?" is what a guessing attack
 *     needs — so it asks on submit, once.
 */
import { useState } from "react";
import { validateCoupon, getCoupon, setCoupon } from "@/lib/cart-client";
import { Price } from "@/components/Price";

export function CouponField({ subtotal }: { subtotal: number }) {
  const [applied, setApplied] = useState<string | null>(() => getCoupon());
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    const entered = code.trim().toUpperCase();
    if (!entered || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await validateCoupon(entered, subtotal);
      setCoupon(result.code);
      setApplied(result.code);
      setSaving(Number(result.deduction) || 0);
      setCode("");
    } catch (err) {
      // The platform's messages are already shopper-facing — "This discount has
      // expired.", "Minimum order amount of 3000 required." Passing them
      // through is the difference between trying another code and giving up.
      setError(err instanceof Error ? err.message : "That code could not be applied.");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    setCoupon(null);
    setApplied(null);
    setSaving(null);
    setError("");
  }

  if (applied) {
    return (
      <div className="coupon coupon--applied">
        <div>
          <span className="coupon__code">{applied}</span>
          {saving != null && saving > 0 ? (
            <span className="coupon__saving">
              &minus;<Price amount={String(saving)} />
            </span>
          ) : null}
        </div>
        <button type="button" className="coupon__remove" onClick={remove}>
          Remove
        </button>
        {/* Said plainly, because the number above is not final and a shopper
            who thinks it is will feel misled at checkout. */}
        <p className="kf__help coupon__note">Applied at checkout.</p>
      </div>
    );
  }

  return (
    <form className="coupon" onSubmit={apply}>
      <label className="kf__label" htmlFor="coupon-code">Discount code</label>
      <div className="coupon__row">
        <input
          id="coupon-code"
          name="coupon"
          type="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="Enter code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "coupon-error" : undefined}
        />
        <button type="submit" className="btn btn--ghost" disabled={busy || !code.trim()}>
          {busy ? "Checking…" : "Apply"}
        </button>
      </div>
      {error ? <p className="kf__error" id="coupon-error">{error}</p> : null}
    </form>
  );
}

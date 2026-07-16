"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getCart, setLineQuantity, removeLine, checkoutHref,
  cartSubtotal, lineTotal, type CartLine,
} from "@/lib/cart-client";
import { Price } from "@/components/Price";
import { TrashIcon, ArrowRight } from "@/components/Icon";

/** cart template — live cart backed by the storefront cart API. */
export default function CartPage() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const refresh = useCallback(async () => {
    const cart = await getCart();
    setLines(((cart?.lines as CartLine[] | undefined) ?? []));
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const mutate = async (fn: () => Promise<unknown>) => {
    setWorking(true);
    try { await fn(); } finally { await refresh(); setWorking(false); }
  };

  if (loading) {
    return <section className="section"><p className="muted">Loading your cart…</p></section>;
  }

  if (lines.length === 0) {
    return (
      <section className="section">
        <h1 className="section__title">Your cart</h1>
        <p className="muted">Your cart is empty.</p>
        <a className="btn" href="/search">Continue shopping</a>
      </section>
    );
  }

  const subtotal = cartSubtotal(lines);

  return (
    <section className="section cart">
      <h1 className="section__title">Your cart</h1>

      <ul className="cart__lines">
        {lines.map((l) => (
          <li key={l.id} className="cart__line">
            {l.image_src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="cart__thumb" src={l.image_src} alt={l.product_title ?? ""} />
            ) : (
              <div className="cart__thumb cart__thumb--empty" aria-hidden="true" />
            )}
            <div className="cart__meta">
              <span className="cart__title">{l.product_title ?? "Item"}</span>
              {l.variant_title && <span className="cart__variant muted">{l.variant_title}</span>}
            </div>
            <label className="cart__qty">
              <span className="sr-only">Quantity</span>
              <input
                type="number"
                min={1}
                value={l.quantity}
                disabled={working}
                onChange={(e) => {
                  const q = Math.max(1, Number(e.target.value) || 1);
                  mutate(() => setLineQuantity(l.id, q));
                }}
              />
            </label>
            <Price amount={String(lineTotal(l))} />
            <button className="cart__remove" disabled={working} onClick={() => mutate(() => removeLine(l.id))}>
              <TrashIcon /> Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="cart__foot">
        <div className="cart__subtotal">
          <span className="muted">Subtotal</span>
          <Price amount={String(subtotal)} />
        </div>
        <a className="btn btn--primary btn--block" href={checkoutHref()}>Checkout <ArrowRight /></a>
        <p className="cart__note">Taxes and shipping are calculated at checkout.</p>
      </div>
    </section>
  );
}

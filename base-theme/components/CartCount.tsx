"use client";

import { useEffect, useState } from "react";
import { getCart } from "@/lib/cart-client";

/** Live item-count badge on the cart icon. Updates on the `kurumera:cart` event. */
export function CartCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const cart = await getCart();
      const lines = (cart?.lines as { quantity?: number }[] | undefined) ?? [];
      const n = lines.reduce((s, l) => s + (l.quantity ?? 0), 0);
      if (alive) setCount(n);
    };
    load();
    window.addEventListener("kurumera:cart", load);
    return () => { alive = false; window.removeEventListener("kurumera:cart", load); };
  }, []);

  if (count <= 0) return null;
  return <span className="cart-count">{count}</span>;
}

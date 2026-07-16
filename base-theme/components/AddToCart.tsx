"use client";

import { useState } from "react";
import { addToCart } from "@/lib/cart-client";
import { CartIcon, CheckIcon } from "@/components/Icon";

/** Add-to-cart button. `variantId` is the product's variant to add. */
export function AddToCart({ variantId, available }: { variantId?: string; available: boolean }) {
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "error">("idle");

  if (!available) return <button className="btn btn--block" disabled>Sold out</button>;
  if (!variantId) return <button className="btn btn--block" disabled>Unavailable</button>;

  const label = {
    idle: "Add to cart",
    adding: "Adding…",
    added: "Added",
    error: "Try again",
  }[status];

  return (
    <button
      className="btn btn--primary btn--block"
      disabled={status === "adding"}
      onClick={async () => {
        setStatus("adding");
        try {
          await addToCart(variantId);
          setStatus("added");
          setTimeout(() => setStatus("idle"), 1600);
        } catch {
          setStatus("error");
          setTimeout(() => setStatus("idle"), 2000);
        }
      }}
    >
      {status === "added" ? <CheckIcon /> : <CartIcon />}
      {label}
    </button>
  );
}

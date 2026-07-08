import type { Money } from "@kurumera/storefront";

/** Render a decimal money string. Compare-at shows as a struck-through "was". */
export function Price({ amount, compareAt }: { amount: Money; compareAt?: Money | null }) {
  const onSale = compareAt && Number(compareAt) > Number(amount);
  return (
    <span className="price">
      <span className="price__now">Rs {formatMoney(amount)}</span>
      {onSale ? <s className="price__was">Rs {formatMoney(compareAt!)}</s> : null}
    </span>
  );
}

function formatMoney(v: Money): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : v;
}

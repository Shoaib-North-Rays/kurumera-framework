import Link from "next/link";

export const metadata = {
  title: "Checkout cancelled — Kurumera Templates",
  robots: { index: false },
};

export default function PurchaseCancelPage() {
  return (
    <div className="wrap">
      <div className="purchase">
        <h1>Checkout cancelled</h1>
        <p className="muted">No worries — you weren&rsquo;t charged. Pick up where you left off whenever you&rsquo;re ready.</p>
        <div className="purchase__actions">
          <Link className="btn btn--primary" href="/templates">Browse templates</Link>
        </div>
      </div>
    </div>
  );
}

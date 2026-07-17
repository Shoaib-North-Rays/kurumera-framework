import { Suspense } from "react";
import { PurchaseComplete } from "@/components/PurchaseComplete";

export const metadata = {
  title: "Purchase complete — Kurumera Templates",
  robots: { index: false },
};

export default function PurchaseCompletePage() {
  return (
    <div className="wrap">
      <Suspense fallback={<div className="purchase"><p className="muted">Loading…</p></div>}>
        <PurchaseComplete />
      </Suspense>
    </div>
  );
}

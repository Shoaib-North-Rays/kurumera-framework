import Link from "next/link";
import type { Metadata } from "next";
import { BUILDER_ORIGIN } from "@/lib/registry";

/**
 * Where Stripe sends a creator after Express onboarding.
 *
 * `safeReturnUrl()` in ops/push-service.mjs defaults both the return and
 * refresh URL to `${MARKET_APP_URL}/creator/payouts` — and that route did not
 * exist. A creator who completed Stripe's onboarding, handed over their bank
 * details and identity documents, was dropped on a 404. That is the worst
 * possible moment to look broken.
 *
 * It is deliberately not a dashboard. Earnings and the payout method live in
 * the builder app (`/earnings`), which this page cannot read; inventing a
 * second, thinner version here would just be another thing to keep in step.
 * It confirms the step completed and points at the one real surface.
 */
export const metadata: Metadata = {
  title: "Payouts",
  robots: { index: false, follow: false },
};

export default function CreatorPayouts() {
  return (
    <div className="wrap" style={{ padding: "clamp(3rem, 9vw, 6rem) 0", maxWidth: "44rem" }}>
      <p style={{ fontSize: "var(--t-meta)", fontWeight: 700, letterSpacing: "var(--ls-label)", textTransform: "uppercase", color: "var(--green-dark)" }}>
        Creator payouts
      </p>
      <h1 style={{ marginTop: "var(--s-4)", fontSize: "var(--t-h1)", lineHeight: "var(--lh-heading)", letterSpacing: "var(--ls-heading)", fontWeight: 800 }}>
        You&rsquo;re back from Stripe.
      </h1>
      <p style={{ marginTop: "var(--s-5)", color: "var(--muted)", lineHeight: "var(--lh-body)" }}>
        If you finished the steps there, your payout account is connected. Stripe
        sometimes takes a few minutes to confirm, and it will tell you directly if
        anything is still outstanding.
      </p>
      <p style={{ marginTop: "var(--s-4)", color: "var(--muted)", lineHeight: "var(--lh-body)" }}>
        Your sales, what you&rsquo;ve earned after the platform fee, and your payout
        details all live in the builder.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)", marginTop: "var(--s-7)" }}>
        <a className="btn btn--primary" href={`${BUILDER_ORIGIN}/earnings`}>View earnings &amp; payouts</a>
        <Link className="btn btn--secondary" href="/creator">Back to my templates</Link>
      </div>

      <p style={{ marginTop: "var(--s-7)", fontSize: "var(--t-caption)", color: "var(--faint)", lineHeight: "var(--lh-body)" }}>
        Something not right? Email{" "}
        <a href="mailto:info@kurumera.com" style={{ color: "var(--green-dark)" }}>info@kurumera.com</a>{" "}
        and include the email address on your Kurumera account.
      </p>
    </div>
  );
}

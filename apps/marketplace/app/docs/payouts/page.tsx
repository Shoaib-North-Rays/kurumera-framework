import Link from "next/link";
import type { Metadata } from "next";
import { DocShell, DocPager, type TocItem } from "@/components/docs/DocShell";
import { BUILDER_ORIGIN } from "@/lib/registry";
import {
  CREATOR_SHARE_PCT, PLATFORM_FEE_PCT, PAYOUT_SCHEDULE,
  CURRENCY, LEGAL_EFFECTIVE, entity,
} from "@/lib/legal";
import "@/app/docs.css";

/**
 * How a creator gets paid.
 *
 * Written against the actual money path in ops/push-service.mjs, not against
 * how a marketplace usually works:
 *   · Destination charge with an application fee (:685-686) — the creator's
 *     share moves at the moment of sale, it is not accrued and settled later.
 *   · Stripe Connect Express onboarding (:2018).
 *   · A full refund or a dispute reverses the destination transfer (:2249-2255);
 *     a PARTIAL refund deliberately does not, and is handled by hand.
 *
 * That last distinction is the kind of thing a creator discovers at the worst
 * possible moment, so it is stated plainly rather than buried.
 */
export const metadata: Metadata = {
  title: "Getting paid",
  description: `How Kurumera pays creators: the ${CREATOR_SHARE_PCT}/${PLATFORM_FEE_PCT} split, Stripe Connect onboarding, payout timing, and what happens on a refund or dispute.`,
  alternates: { canonical: "/docs/payouts" },
};

const TOC: TocItem[] = [
  { id: "connect", label: "Connect Stripe" },
  { id: "flow", label: "How a sale flows" },
  { id: "split", label: "The split" },
  { id: "when", label: "When you get paid" },
  { id: "refunds", label: "Refunds & disputes" },
  { id: "earnings", label: "Reading your earnings" },
  { id: "trouble", label: "If something is wrong" },
];

export default function PayoutsDoc() {
  return (
    <DocShell toc={TOC}>
      <header className="doc-hero">
        <p className="doc-hero__eyebrow">Creator guide</p>
        <h1>Getting paid</h1>
        <p className="doc-hero__lede">
          Your share of a sale moves at the moment the buyer pays — it is not held
          in a balance here and released later. Here is the whole path, including
          the parts that only matter when something goes wrong.
        </p>
        <div className="doc-hero__meta">
          <span>Last reviewed {LEGAL_EFFECTIVE}</span>
          <span>Payments processed by Stripe</span>
        </div>
      </header>

      <div className="factgrid">
        <div className="fact">
          <div className="fact__v">{CREATOR_SHARE_PCT}%</div>
          <p className="fact__k">Your share of every sale, before Stripe&rsquo;s own processing fee</p>
        </div>
        <div className="fact">
          <div className="fact__v">{CURRENCY}</div>
          <p className="fact__k">Listings are priced and settled in US dollars</p>
        </div>
        <div className="fact">
          <div className="fact__v">$0</div>
          <p className="fact__k">To list. No fee, no subscription, no minimum</p>
        </div>
      </div>

      <div className="prose">
        {/* ── Connect ────────────────────────────────────────────────── */}
        <h2 id="connect">Connect Stripe first</h2>
        <p>
          Kurumera pays creators through <strong>Stripe Connect</strong>. You complete
          Stripe&rsquo;s own onboarding — identity, bank details, tax details for your
          country — and Stripe verifies you. Kurumera never sees or stores your bank
          details.
        </p>
        <p>
          Start it from{" "}
          <a href={`${BUILDER_ORIGIN}/earnings`}>your earnings page in the builder</a>.
          When you finish, Stripe returns you to Kurumera and confirms the connection.
        </p>

        <div className="callout callout--warn">
          <span className="callout__title">Do this before you publish, not after your first sale</span>
          <p>
            A transfer needs a verified account to land in. If a sale completes
            before yours is connected and charges-enabled, there is <strong>no
            account to route your share to</strong>, and the payment is taken in
            full by the platform rather than split. Nothing transfers to you
            later on its own &mdash; it has to be settled by hand, and you have to
            notice it and ask.
          </p>
          <p>
            Connect first and this cannot happen to you. If it already has, email{" "}
            <a href={`mailto:${entity.supportEmail}`}>{entity.supportEmail}</a> with
            the template name and we will put it right.
          </p>
        </div>

        <h3>What Stripe will ask for</h3>
        <ul>
          <li>Your legal name, or your company&rsquo;s, and its address.</li>
          <li>A government ID, or company registration details.</li>
          <li>A bank account in a country Stripe supports for your account type.</li>
          <li>Tax details required in your country — see <Link href="/docs/taxes">tax responsibilities</Link>.</li>
        </ul>

        {/* ── Flow ───────────────────────────────────────────────────── */}
        <h2 id="flow">How a sale flows</h2>
        <p>
          There is no holding balance on Kurumera&rsquo;s side. The buyer&rsquo;s payment is
          split by Stripe as it is captured:
        </p>

        <div className="steps">
          <div className="step">
            <h3 className="step__title">A buyer pays</h3>
            <div className="step__body">
              <p>Stripe Checkout takes the card. The full list price is charged once.</p>
            </div>
          </div>
          <div className="step">
            <h3 className="step__title">Stripe splits it</h3>
            <div className="step__body">
              <p>
                Your {CREATOR_SHARE_PCT}% is transferred to your connected account as
                part of the same charge. Kurumera&rsquo;s {PLATFORM_FEE_PCT}% is taken as an
                application fee.
              </p>
            </div>
          </div>
          <div className="step">
            <h3 className="step__title">The buyer gets their licence</h3>
            <div className="step__body">
              <p>
                A licence key is issued the moment Stripe confirms the payment — not
                when the buyer returns to the site, so closing the tab does not lose it.
              </p>
            </div>
          </div>
          <div className="step">
            <h3 className="step__title">Stripe pays out to your bank</h3>
            <div className="step__body">
              <p>
                On your account&rsquo;s payout schedule. That step is between you and
                Stripe; Kurumera is not in the middle of it.
              </p>
            </div>
          </div>
        </div>

        {/* ── Split ──────────────────────────────────────────────────── */}
        <h2 id="split">The split, exactly</h2>
        <p>
          Kurumera takes {PLATFORM_FEE_PCT}% of the list price. Stripe charges its own
          processing fee against your connected account, at your country&rsquo;s rate — so
          the third column below is what Kurumera sends, not the final figure in your
          bank.
        </p>

        <div className="dtable-wrap">
          <table className="dtable">
            <caption className="sr-only">Worked example of the revenue split on a $79 sale</caption>
            <thead>
              <tr>
                <th scope="col">Line</th>
                <th scope="col" className="num">Amount</th>
                <th scope="col">Who</th>
              </tr>
            </thead>
            <tbody>
              <tr><th scope="row">Buyer pays</th><td className="num">$79.00</td><td>Charged once, in {CURRENCY}</td></tr>
              <tr><th scope="row">Platform fee ({PLATFORM_FEE_PCT}%)</th><td className="num">−$15.80</td><td>Kurumera</td></tr>
              <tr><th scope="row">Transferred to you</th><td className="num">$63.20</td><td>Your Stripe account</td></tr>
              <tr><th scope="row">Stripe processing</th><td className="num">varies</td><td>Charged by Stripe, at your rate</td></tr>
            </tbody>
          </table>
        </div>

        <div className="callout callout--money">
          <span className="callout__title">What the platform share pays for</span>
          <p>
            Hosting and bandwidth for every listing and live preview, cover rendering,
            licence issuing and verification, payment infrastructure, fraud and
            chargeback handling, and buyer support.
          </p>
        </div>

        {/* ── When ───────────────────────────────────────────────────── */}
        <h2 id="when">When the money arrives</h2>
        <p>
          Your share reaches your Stripe account at the point of sale. Stripe then
          pays it to your bank on {PAYOUT_SCHEDULE}.
        </p>
        <p>
          The exact schedule is set by Stripe and visible in your Stripe dashboard,
          where you can also change it if your account type allows. First payouts are
          usually slower while an account is being verified — that is Stripe&rsquo;s
          verification, not a hold by Kurumera.
        </p>

        {/* ── Refunds ────────────────────────────────────────────────── */}
        <h2 id="refunds">Refunds and disputes</h2>
        <p>
          This is the part worth reading twice, because the two cases behave
          differently and the difference is deliberate.
        </p>

        <div className="dtable-wrap">
          <table className="dtable">
            <caption className="sr-only">What happens to the licence and your transfer in each refund case</caption>
            <thead>
              <tr>
                <th scope="col">Event</th>
                <th scope="col">Buyer&rsquo;s licence</th>
                <th scope="col">Your transfer</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Full refund</th>
                <td>Revoked automatically</td>
                <td>Reversed automatically</td>
              </tr>
              <tr>
                <th scope="row">Dispute / chargeback</th>
                <td>Revoked automatically</td>
                <td>Reversed automatically</td>
              </tr>
              <tr>
                <th scope="row">Partial refund</th>
                <td>Stays valid</td>
                <td>Not reversed — handled case by case</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p>
          A partial refund is treated as a goodwill adjustment rather than an undone
          sale, so the buyer keeps what they bought and nothing is clawed back
          automatically. If a partial refund should also have affected your balance,
          it is settled manually — email{" "}
          <a href={`mailto:${entity.supportEmail}`}>{entity.supportEmail}</a>.
        </p>

        <div className="callout callout--warn">
          <span className="callout__title">Chargebacks cost more than the sale</span>
          <p>
            Stripe charges a dispute fee against the account that received the funds.
            The best defence is an accurate listing and answering buyers quickly — most
            chargebacks start as an unanswered email.
          </p>
        </div>

        {/* ── Earnings ───────────────────────────────────────────────── */}
        <h2 id="earnings">Reading your earnings</h2>
        <p>
          <a href={`${BUILDER_ORIGIN}/earnings`}>Your earnings page</a> lists each
          template, its sales and installs, and your share. It is a view of your
          Kurumera listings.
        </p>
        <p>
          <strong>Stripe is the record of what you were actually paid.</strong> Your
          Stripe dashboard shows real transfers, real payout dates and real fees. If
          the two ever disagree, Stripe is right — tell us and we will fix the view.
        </p>

        {/* ── Trouble ────────────────────────────────────────────────── */}
        <h2 id="trouble">If something is wrong</h2>
        <h3>A sale is not showing</h3>
        <p>
          Check the Stripe dashboard first. If the payment is there and Kurumera does
          not show it, that is a bug on our side — send us the payment reference.
        </p>
        <h3>Stripe onboarding will not complete</h3>
        <p>
          Stripe tells you what is outstanding, and only Stripe can clear it. Common
          causes are an unsupported country for the account type, a name that does not
          match the ID, or a bank account in a different currency.
        </p>
        <h3>A payout has not arrived</h3>
        <p>
          Payout status lives in your Stripe dashboard, including the reason for any
          hold. Kurumera cannot release a Stripe payout.
        </p>
        <p>
          Anything else:{" "}
          <a href={`mailto:${entity.supportEmail}`}>{entity.supportEmail}</a>. Include
          the template name and, if it is about one sale, the Stripe payment reference.
        </p>
      </div>

      <DocPager href="/docs/payouts" />
    </DocShell>
  );
}

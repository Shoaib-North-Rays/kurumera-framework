import Link from "next/link";
import type { Metadata } from "next";
import { DocShell, DocPager, type TocItem } from "@/components/docs/DocShell";
import { LEGAL_EFFECTIVE, entity, REFUND_WINDOW_DAYS, LICENSE_SEATS } from "@/lib/legal";
import "@/app/docs.css";

/**
 * Refund policy.
 *
 * There was none. Two surfaces implied refunds existed, the checkout captured
 * no consent to immediate delivery, and the only actual refund behaviour lived
 * in a webhook handler nobody outside the codebase could read.
 *
 * The mechanism described here is verified, not assumed:
 *   · A full refund or a dispute revokes the licence and reverses the creator's
 *     transfer — push-service.mjs:2243-2255.
 *   · A PARTIAL refund deliberately does neither. The buyer keeps the licence.
 *
 * The {REFUND_WINDOW_DAYS}-day window is the one genuinely discretionary number
 * on the page and it lives in lib/legal.ts, chosen to match the EU/UK statutory
 * withdrawal period rather than to be generous. See the note there.
 */
export const metadata: Metadata = {
  title: "Refund policy",
  description: `When a Kurumera template purchase can be refunded, how to ask, and what happens to your licence — ${REFUND_WINDOW_DAYS}-day window.`,
  alternates: { canonical: "/refunds" },
};

const TOC: TocItem[] = [
  { id: "r-short", label: "The short version" },
  { id: "r-eligible", label: "When we refund" },
  { id: "r-not", label: "When we do not" },
  { id: "r-how", label: "How to ask" },
  { id: "r-happens", label: "What happens next" },
  { id: "r-consumer", label: "Consumer rights" },
  { id: "r-disputes", label: "Chargebacks" },
  { id: "r-creators", label: "For creators" },
];

export default function RefundsPage() {
  return (
    <DocShell toc={TOC}>
      <header className="doc-hero">
        <p className="doc-hero__eyebrow">Legal</p>
        <h1>Refund policy</h1>
        <p className="doc-hero__lede">
          Templates are digital and delivered instantly, which makes returns
          different from physical goods. Here is exactly when you get your money
          back, and when you do not.
        </p>
        <div className="doc-hero__meta">
          <span>Effective {LEGAL_EFFECTIVE}</span>
          <span>{REFUND_WINDOW_DAYS}-day window</span>
        </div>
      </header>

      <div className="factgrid">
        <div className="fact">
          <div className="fact__v">{REFUND_WINDOW_DAYS} days</div>
          <p className="fact__k">To request a refund from the date of purchase</p>
        </div>
        <div className="fact">
          <div className="fact__v">Free</div>
          <p className="fact__k">Every listing has a live preview before you pay</p>
        </div>
        <div className="fact">
          <div className="fact__v">5–10 days</div>
          <p className="fact__k">For an approved refund to reach your card, via your bank</p>
        </div>
      </div>

      <div className="prose">
        {/* ── Short ──────────────────────────────────────────────────── */}
        <h2 id="r-short">The short version</h2>
        <p>
          If a template does not work, is not what the listing described, or you were
          charged twice, we refund it. If it works as described and you simply changed
          your mind after downloading it, we usually cannot — and{" "}
          <strong>the live preview exists so you never have to find out the hard way.</strong>
        </p>

        <div className="callout callout--note">
          <span className="callout__title">Preview before you buy</span>
          <p>
            Every listing renders the real template with real data. It costs nothing
            and takes a minute, and it resolves almost every reason someone later asks
            for a refund.
          </p>
        </div>

        {/* ── Eligible ───────────────────────────────────────────────── */}
        <h2 id="r-eligible">When we refund</h2>
        <p>
          Within <strong>{REFUND_WINDOW_DAYS} days of purchase</strong>, in any of
          these cases:
        </p>
        <ul>
          <li><strong>It does not install or does not work.</strong> The template fails to install, or is broken in normal use, and the creator cannot fix it in a reasonable time.</li>
          <li><strong>It is materially not as described.</strong> The listing, preview or cover showed something meaningfully different from what you received.</li>
          <li><strong>You were charged more than once</strong> for the same template. We refund the duplicates in full, whenever you notice — the {REFUND_WINDOW_DAYS}-day limit does not apply to a duplicate charge.</li>
          <li><strong>You did not authorise the payment.</strong> Tell us immediately and we will refund it and secure the account.</li>
          <li><strong>You never received your licence key</strong> and we cannot deliver it.</li>
        </ul>

        <div className="callout callout--money">
          <span className="callout__title">Duplicate charges</span>
          <p>
            The checkout now refuses a second purchase of a template you already own.
            If a duplicate charge reached you before that — or gets past it — it is
            refunded in full, no time limit, no argument. Email us with the template
            name.
          </p>
        </div>

        {/* ── Not ────────────────────────────────────────────────────── */}
        <h2 id="r-not">When we usually cannot</h2>
        <ul>
          <li><strong>You changed your mind</strong> and the template works as described. It is a digital good and you already have it.</li>
          <li><strong>You did not preview it first</strong> and it is not to your taste.</li>
          <li><strong>You want a feature it never claimed to have.</strong> Ask the creator — many will add it — but its absence is not a defect.</li>
          <li><strong>You lack the skills or time to customise it.</strong> Templates are starting points, not finished stores.</li>
          <li><strong>You have used all {LICENSE_SEATS} store seats</strong> and want the money back rather than more seats.</li>
          <li><strong>The {REFUND_WINDOW_DAYS} days have passed</strong> — unless it is a duplicate or unauthorised charge, which have no limit.</li>
        </ul>
        <p>
          These are the usual outcomes, not rigid rules. If your situation is genuinely
          unfair, say so and a person will read it.
        </p>

        {/* ── How ────────────────────────────────────────────────────── */}
        <h2 id="r-how">How to ask</h2>
        <div className="steps">
          <div className="step">
            <h3 className="step__title">Email us</h3>
            <div className="step__body">
              <p>
                <a href={`mailto:${entity.supportEmail}?subject=Refund%20request`}>{entity.supportEmail}</a>,
                from the address you bought with, with the template name and what went
                wrong. A screenshot or an error message makes it much faster.
              </p>
            </div>
          </div>
          <div className="step">
            <h3 className="step__title">We look into it</h3>
            <div className="step__body">
              <p>
                Within two business days. If it is a technical fault we may loop in the
                creator first, because a fix in an hour usually beats a refund in a week
                — we will ask you before doing that.
              </p>
            </div>
          </div>
          <div className="step">
            <h3 className="step__title">We decide, and tell you why</h3>
            <div className="step__body">
              <p>
                If we decline, you get a reason you can argue with, not a form letter.
              </p>
            </div>
          </div>
          <div className="step">
            <h3 className="step__title">The money goes back</h3>
            <div className="step__body">
              <p>
                To the original payment method, through Stripe. Typically 5–10 business
                days depending on your bank — that part is out of our hands.
              </p>
            </div>
          </div>
        </div>

        {/* ── What happens ───────────────────────────────────────────── */}
        <h2 id="r-happens">What a refund does to your licence</h2>
        <p>
          A full refund <strong>revokes the licence key automatically</strong>. You must
          stop using the template and remove it from your stores. You can buy it again
          later if you change your mind — a revoked licence does not block a fresh
          purchase.
        </p>
        <p>
          A <strong>partial</strong> refund, if we agree one as a goodwill adjustment,
          leaves your licence intact. You keep the template.
        </p>

        <div className="dtable-wrap">
          <table className="dtable">
            <caption className="sr-only">What each refund outcome does to the licence</caption>
            <thead>
              <tr><th scope="col">Outcome</th><th scope="col">Your licence</th><th scope="col">Your money</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">Full refund</th><td>Revoked</td><td>Returned in full</td></tr>
              <tr><th scope="row">Partial refund</th><td>Stays valid</td><td>Part returned</td></tr>
              <tr><th scope="row">Declined</th><td>Stays valid</td><td>No change</td></tr>
              <tr><th scope="row">Duplicate charge</th><td>One licence stays valid</td><td>Extra charges returned</td></tr>
            </tbody>
          </table>
        </div>

        {/* ── Consumer ───────────────────────────────────────────────── */}
        <h2 id="r-consumer">Your rights as a consumer</h2>
        <p>
          Nothing here limits rights you have under the consumer law where you live,
          and where that law gives you more than this policy does, it wins.
        </p>
        <p>
          <strong>EU and UK buyers:</strong> distance selling rules normally give you a
          14-day right to withdraw. For digital content delivered immediately, that
          right can be lost once delivery begins with your agreement — and completing
          checkout here is that agreement, because your licence key is issued the moment
          payment confirms. We offer the {REFUND_WINDOW_DAYS}-day window above
          regardless, and your statutory rights where the content is faulty or not as
          described are untouched.
        </p>

        {/* ── Disputes ───────────────────────────────────────────────── */}
        <h2 id="r-disputes">Chargebacks</h2>
        <p>
          Please email us before raising a chargeback with your bank. We will almost
          always resolve it faster, and a chargeback:
        </p>
        <ul>
          <li>revokes your licence immediately, before anyone has reviewed anything;</li>
          <li>reverses the creator&rsquo;s payment and charges them a dispute fee, even when they were not at fault;</li>
          <li>takes weeks rather than days.</li>
        </ul>
        <p>
          If you genuinely did not authorise a payment, raise it with your bank — that
          is exactly what the process is for.
        </p>

        {/* ── Creators ───────────────────────────────────────────────── */}
        <h2 id="r-creators">If you are a creator</h2>
        <p>
          When a sale of yours is fully refunded or disputed, the transfer is reversed
          and the buyer&rsquo;s licence is revoked. Partial refunds are not reversed
          automatically and are settled with you directly.
        </p>
        <p>
          We will normally ask you before refunding a technical fault, because you may
          be able to fix it. What keeps refund rates near zero is an accurate listing, a
          preview that shows the real thing, and answering buyers quickly — more detail
          in <Link href="/docs/creator-guide#test">the creator guide</Link>.
        </p>

        <hr />
        <p>
          Related: <Link href="/terms">Terms of Service</Link> ·{" "}
          <Link href="/license">Template Licence</Link> ·{" "}
          <Link href="/docs/payouts">Getting paid</Link>
        </p>
      </div>

      <DocPager href="/refunds" />
    </DocShell>
  );
}

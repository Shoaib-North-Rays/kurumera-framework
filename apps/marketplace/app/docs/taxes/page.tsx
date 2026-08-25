import Link from "next/link";
import type { Metadata } from "next";
import { DocShell, DocPager, type TocItem } from "@/components/docs/DocShell";
import { BUILDER_ORIGIN } from "@/lib/registry";
import { CREATOR_SHARE_PCT, PLATFORM_FEE_PCT, CURRENCY, LEGAL_EFFECTIVE, entity } from "@/lib/legal";
import "@/app/docs.css";

/**
 * Tax responsibilities.
 *
 * The most dangerous page in this set, and the one where the temptation to be
 * reassuring is strongest. Two rules held throughout:
 *
 *   1. Describe the system as it IS. I verified there is no `automatic_tax`,
 *      no `tax_id_collection` and no `invoice_creation` anywhere in the
 *      Checkout Session (ops/push-service.mjs) — no tax is calculated,
 *      collected or remitted at checkout, for anyone, in any country. Writing
 *      anything softer than that would be a false statement about money.
 *
 *   2. Never give tax advice. This says who is responsible for what and what
 *      the platform does and does not do. It does not tell anyone what they
 *      owe, and it says plainly that it is not advice — because a creator in
 *      Lagos, Lisbon and Los Angeles reading the same paragraph have three
 *      genuinely different answers and none of them are mine to give.
 *
 * If VAT/GST handling changes, this page changes with it. Until then it is
 * accurate, which is the only property that matters here.
 */
export const metadata: Metadata = {
  title: "Tax responsibilities",
  description: "Who is responsible for tax on a Kurumera sale, what the platform does and does not collect, and what records to keep.",
  alternates: { canonical: "/docs/taxes" },
};

const TOC: TocItem[] = [
  { id: "short", label: "The short version" },
  { id: "seller", label: "Who is the seller" },
  { id: "platform", label: "What Kurumera does" },
  { id: "creators", label: "If you sell" },
  { id: "buyers", label: "If you buy" },
  { id: "records", label: "Records to keep" },
  { id: "advice", label: "Getting advice" },
];

export default function TaxesDoc() {
  return (
    <DocShell toc={TOC}>
      <header className="doc-hero">
        <p className="doc-hero__eyebrow">Creator guide</p>
        <h1>Tax responsibilities</h1>
        <p className="doc-hero__lede">
          What Kurumera does and does not do about tax, and what that leaves you
          responsible for. Written to be accurate rather than comfortable.
        </p>
        <div className="doc-hero__meta">
          <span>Last reviewed {LEGAL_EFFECTIVE}</span>
          <span>Not tax advice</span>
        </div>
      </header>

      <div className="tldr">
        <p className="tldr__title">The short version</p>
        <ul>
          <li>
            <strong>You are responsible for your own taxes.</strong> Kurumera is not
            your tax agent and does not file anything on your behalf.
          </li>
          <li>
            <strong>Kurumera does not calculate, collect or remit VAT, GST or sales
            tax</strong> on template sales. Listed prices are the full amount charged.
          </li>
          <li>
            <strong>Stripe handles tax identity.</strong> It collects the tax details
            your country requires during onboarding and reports where it is obliged to.
          </li>
          <li>
            <strong>Your {CREATOR_SHARE_PCT}% share is income.</strong> Declare it
            wherever you are tax resident.
          </li>
        </ul>
        <p className="tldr__foot">
          This page is general information about how the platform works. It is not
          tax or legal advice, and it is not a substitute for an accountant who knows
          your situation.
        </p>
      </div>

      <div className="prose">
        {/* ── Short ──────────────────────────────────────────────────── */}
        <h2 id="short">Why this page is blunt</h2>
        <p>
          Digital goods sold across borders are one of the messiest areas of tax there
          is, and the rules depend on where you are, where your buyer is, how much you
          sell and what you are registered for. No page can resolve that for you.
        </p>
        <p>
          What a page <em>can</em> do is tell you exactly what the platform does, so you
          know precisely which parts are left to you. That is what this is.
        </p>

        {/* ── Seller ─────────────────────────────────────────────────── */}
        <h2 id="seller">Who is the seller</h2>
        <p>
          When someone buys your template, <strong>you are the seller</strong>. Kurumera
          operates the marketplace and takes a {PLATFORM_FEE_PCT}% fee for doing so; it
          does not buy your template and resell it.
        </p>
        <p>
          The money reflects that. The buyer&rsquo;s payment is split by Stripe as it is
          captured and your share goes to <em>your</em> Stripe account, not into a
          Kurumera balance that is later paid out. See{" "}
          <Link href="/docs/payouts">getting paid</Link>.
        </p>

        <div className="callout callout--warn">
          <span className="callout__title">Kurumera is not a merchant of record</span>
          <p>
            Some marketplaces act as merchant of record and take on the seller&rsquo;s tax
            obligations. <strong>Kurumera does not.</strong> If you have sold through a
            platform that did, do not assume the same treatment here.
          </p>
        </div>

        {/* ── Platform ───────────────────────────────────────────────── */}
        <h2 id="platform">What Kurumera does and does not do</h2>

        <div className="dtable-wrap">
          <table className="dtable">
            <caption className="sr-only">Platform tax responsibilities, current position</caption>
            <thead>
              <tr><th scope="col">Item</th><th scope="col">Position</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">Calculates VAT / GST / sales tax</th><td>No. Listed prices are the full amount charged.</td></tr>
              <tr><th scope="row">Collects tax at checkout</th><td>No.</td></tr>
              <tr><th scope="row">Remits tax to any authority</th><td>No.</td></tr>
              <tr><th scope="row">Collects buyer tax IDs</th><td>No.</td></tr>
              <tr><th scope="row">Issues tax invoices</th><td>No. Stripe emails a payment receipt.</td></tr>
              <tr><th scope="row">Collects creator tax details</th><td>Yes — through Stripe, during onboarding.</td></tr>
              <tr><th scope="row">Reports creator earnings</th><td>Stripe reports where legally required for your country and account.</td></tr>
              <tr><th scope="row">Files anything on your behalf</th><td>No.</td></tr>
            </tbody>
          </table>
        </div>

        <p>
          This is the current position and it is stated so you are not surprised by it.
          If it changes, this page changes on the same day, and anyone selling here will
          be told.
        </p>

        {/* ── Creators ───────────────────────────────────────────────── */}
        <h2 id="creators">If you sell templates</h2>

        <h3>Income tax</h3>
        <p>
          Your {CREATOR_SHARE_PCT}% share is income from self-employment or from your
          company, depending on how you are set up. Declare it where you are tax
          resident, on your normal schedule.
        </p>

        <h3>VAT, GST and sales tax</h3>
        <p>
          Because nothing is collected at checkout, any indirect tax due on your sales
          is yours to assess, and yours to register for if you cross a threshold. That
          may mean treating your listed price as tax-inclusive and accounting for the
          tax out of it. Which rules apply depends on where you are established and
          where your buyers are — this is exactly the question to take to an accountant
          before you set your prices, not after.
        </p>

        <h3>The information Stripe collects</h3>
        <p>
          Stripe asks for the tax details your country requires when you onboard — for
          example a W-9 or W-8 series form for US-connected accounts. Stripe issues the
          reporting forms it is obliged to, such as a 1099-K where the thresholds are
          met, and those appear in your Stripe dashboard.
        </p>

        <h3>Currency</h3>
        <p>
          Listings are priced and settled in {CURRENCY}. If that is not your local
          currency, you will usually need to convert at a rate your tax authority
          accepts — typically the rate on the transaction date. Stripe&rsquo;s reports show
          both the charged amount and what was paid out.
        </p>

        {/* ── Buyers ─────────────────────────────────────────────────── */}
        <h2 id="buyers">If you buy a template</h2>
        <p>
          The price shown on a listing is the amount charged to your card. No tax is
          added at checkout, and no tax is itemised, because none is calculated or
          collected.
        </p>
        <p>
          Stripe emails a payment receipt to the address you enter at checkout. That
          receipt evidences the payment; it is not a tax invoice, and it does not carry
          a VAT or GST number.
        </p>
        <p>
          Buying for a business in a jurisdiction that applies a reverse charge, or
          needing a formal invoice for your records, is a reasonable request — email{" "}
          <a href={`mailto:${entity.supportEmail}`}>{entity.supportEmail}</a> with the
          purchase reference and what your accountant needs.
        </p>

        {/* ── Records ────────────────────────────────────────────────── */}
        <h2 id="records">Records worth keeping</h2>
        <p>
          Your Stripe dashboard is the authoritative record of what you were paid, and
          Stripe retains it — but export it periodically anyway. Most tax authorities
          expect several years of records, which is longer than you should rely on any
          single account staying open.
        </p>
        <ul>
          <li>Stripe payout and balance reports, per period.</li>
          <li>Per-transaction records: date, amount, currency, fees.</li>
          <li>Your listing prices over time, if you have changed them.</li>
          <li>Refunds and disputes, which reduce your income for the period.</li>
        </ul>
        <p>
          <a href={`${BUILDER_ORIGIN}/earnings`}>The earnings page</a> is a convenience
          view of your listings. For anything you file, use Stripe — it is the record
          of money that actually moved.
        </p>

        {/* ── Advice ─────────────────────────────────────────────────── */}
        <h2 id="advice">Getting proper advice</h2>
        <p>
          If you are selling more than incidentally, talk to an accountant in your own
          country early. The questions worth arriving with:
        </p>
        <ul>
          <li>Do I need to register for VAT, GST or sales tax, and at what threshold?</li>
          <li>Does where my buyers are located change that?</li>
          <li>Should I treat my listed price as tax-inclusive?</li>
          <li>Sole trader or company, at the volume I expect?</li>
          <li>How do I convert {CURRENCY} earnings for my return?</li>
        </ul>

        <div className="callout">
          <span className="callout__title">To be completely clear</span>
          <p>
            Nothing on this page is tax or legal advice, and Kurumera cannot give you
            any. It describes how the platform handles money so that you and your
            adviser can work out what follows from it.
          </p>
        </div>
      </div>

      <DocPager href="/docs/taxes" />
    </DocShell>
  );
}

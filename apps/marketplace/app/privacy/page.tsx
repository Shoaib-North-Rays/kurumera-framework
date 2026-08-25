import Link from "next/link";
import type { Metadata } from "next";
import { DocShell, DocPager, type TocItem } from "@/components/docs/DocShell";
import { LEGAL_EFFECTIVE, entity, governingLaw } from "@/lib/legal";
import "@/app/docs.css";

/**
 * Privacy policy.
 *
 * Rewritten because the previous version made a claim the software does not
 * support: that the email collected at checkout is used "to send your receipt
 * and license key". Nothing in this system emails a licence key — there is no
 * mail dependency in the push-service at all. Stripe sends a payment receipt;
 * the key is shown on the completion page and listed under /purchases. A
 * privacy policy that describes processing that does not happen is inaccurate
 * in the one document where accuracy is the entire point.
 *
 * Everything below was verified against the code rather than assumed:
 *   · No analytics, no tracking pixels, no advertising cookies — grep for
 *     gtag/analytics/posthog/plausible returns nothing. That is a real claim
 *     and worth making plainly.
 *   · Saved templates, recent searches and the signed-in session live in
 *     localStorage (SaveButton.tsx, SearchOverlay.tsx, AccountMenu.tsx) and
 *     are never transmitted.
 *   · The email at checkout is what a Licence Key binds to, which is why it is
 *     collected and why it cannot simply be discarded.
 */
export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Kurumera collects, why, who it is shared with, and how to get it deleted.",
  alternates: { canonical: "/privacy" },
};

const TOC: TocItem[] = [
  { id: "p-short", label: "The short version" },
  { id: "p-collect", label: "What we collect" },
  { id: "p-browser", label: "Stays in your browser" },
  { id: "p-why", label: "Why we hold it" },
  { id: "p-share", label: "Who else sees it" },
  { id: "p-keep", label: "How long" },
  { id: "p-rights", label: "Your rights" },
  { id: "p-security", label: "Security" },
  { id: "p-contact", label: "Contact" },
];

export default function PrivacyPage() {
  return (
    <DocShell toc={TOC}>
      <header className="doc-hero">
        <p className="doc-hero__eyebrow">Legal</p>
        <h1>Privacy Policy</h1>
        <p className="doc-hero__lede">
          What {entity.tradingName} collects, why it exists, and how to make it go
          away. Short, because we genuinely do not collect much.
        </p>
        <div className="doc-hero__meta">
          <span>Effective {LEGAL_EFFECTIVE}</span>
          <span>No advertising or analytics trackers</span>
        </div>
      </header>

      <div className="tldr">
        <p className="tldr__title">In plain English</p>
        <ul>
          <li><strong>No analytics, no ad trackers, no third-party pixels.</strong> Browsing this marketplace is not measured.</li>
          <li>We collect an email address when you buy something, because your licence is bound to it.</li>
          <li>Card details never reach us — Stripe handles payment end to end.</li>
          <li>Saved templates and recent searches never leave your browser.</li>
          <li>We do not sell your data, and we never will.</li>
        </ul>
        <p className="tldr__foot">
          The sections below are the policy and give the detail behind each of these.
        </p>
      </div>

      <div className="prose">
        {/* ── Short ──────────────────────────────────────────────────── */}
        <h2 id="p-short">Who this covers</h2>
        <p>
          This policy covers marketplace.kurumera.com — browsing it, buying a
          template, and publishing one as a creator. It applies whether or not you
          have an account.
        </p>

        {/* ── Collect ────────────────────────────────────────────────── */}
        <h2 id="p-collect">What we collect</h2>

        <h3>If you just look around</h3>
        <p>
          Standard web server logs: IP address, the page requested, timestamp, browser
          user-agent. They exist to keep the service up and to investigate abuse.
          <strong> There is no analytics platform on this site</strong>, no advertising
          network, and no third-party tracking script. We are not measuring your
          journey through the site, because we have not built anything that could.
        </p>

        <h3>If you buy a template</h3>
        <ul>
          <li><strong>Your email address.</strong> This is the important one: your licence key is bound to it, and it is how you retrieve the purchase later. It is also the address Stripe sends the payment receipt to.</li>
          <li><strong>The licence record</strong> — which template, when, the Stripe payment reference, and which stores it has been installed on.</li>
          <li><strong>No card details.</strong> Payment happens on Stripe. Your card number never touches our servers.</li>
        </ul>

        <h3>If you sign in</h3>
        <p>
          Your Kurumera account session, used to authenticate you and to show your own
          purchases and listings. We do not store your password — authentication happens
          against your Kurumera account.
        </p>

        <h3>If you sell templates</h3>
        <ul>
          <li>Your listings and their metadata — name, description, price, category, tags.</li>
          <li>Sales counts and installs for your own templates.</li>
          <li>The identifier of your connected Stripe account, so sales can be routed to it. <strong>Your bank details, ID documents and tax details go to Stripe, not to us.</strong></li>
        </ul>

        {/* ── Browser ────────────────────────────────────────────────── */}
        <h2 id="p-browser">What stays in your browser</h2>
        <p>
          Some things are stored locally on your device and are never sent to us:
        </p>
        <ul>
          <li><strong>Saved templates.</strong> Your saved list lives in your browser&rsquo;s local storage. We do not have a copy, which is also why it does not follow you to another device.</li>
          <li><strong>Recent searches.</strong> Kept locally so the search box can offer them back to you.</li>
          <li><strong>Your session.</strong> Held locally so you stay signed in.</li>
        </ul>
        <p>
          Clearing your browser storage removes all of it permanently — including your
          saved templates, which we cannot restore for you.
        </p>

        {/* ── Why ────────────────────────────────────────────────────── */}
        <h2 id="p-why">Why we hold what we hold</h2>
        <div className="dtable-wrap">
          <table className="dtable">
            <caption className="sr-only">Data collected and the reason for each</caption>
            <thead>
              <tr><th scope="col">Data</th><th scope="col">Why</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">Email at checkout</th><td>To bind and deliver your licence, and to let you recover it later. Without it a purchase cannot be proven or restored.</td></tr>
              <tr><th scope="row">Licence records</th><td>To verify installations, enforce the store limit, and honour refunds.</td></tr>
              <tr><th scope="row">Server logs</th><td>Security, abuse investigation, and keeping the service running.</td></tr>
              <tr><th scope="row">Creator listings &amp; sales</th><td>To operate the marketplace and pay you correctly.</td></tr>
              <tr><th scope="row">Stripe account ID</th><td>To route your share of a sale to you.</td></tr>
            </tbody>
          </table>
        </div>

        {/* ── Share ──────────────────────────────────────────────────── */}
        <h2 id="p-share">Who else sees it</h2>
        <ul>
          <li><strong>Stripe</strong>, our payment processor, for payments and creator payouts. Stripe is a controller of the data it collects and its own privacy policy applies.</li>
          <li><strong>Our hosting provider</strong>, which necessarily processes traffic to run the servers.</li>
          <li><strong>Law enforcement or regulators</strong>, where we are legally obliged. We would tell you unless prohibited from doing so.</li>
        </ul>
        <p>
          <strong>Creators do not receive your email address.</strong> A creator sees
          that a sale happened and the aggregate counts for their own templates — not
          who bought it. If you email a creator for support, that is your own
          disclosure, not ours.
        </p>
        <p>We do not sell personal data, and we do not share it for advertising.</p>

        {/* ── Keep ───────────────────────────────────────────────────── */}
        <h2 id="p-keep">How long we keep it</h2>
        <ul>
          <li><strong>Licence and purchase records</strong> — for as long as the licence is valid, and afterwards as long as tax and accounting rules require. These are financial records; we cannot delete them on request while that obligation stands.</li>
          <li><strong>Server logs</strong> — a short rolling window, then discarded.</li>
          <li><strong>Creator listings</strong> — until you unpublish, plus the sales history attached to them.</li>
        </ul>

        {/* ── Rights ─────────────────────────────────────────────────── */}
        <h2 id="p-rights">Your rights</h2>
        <p>
          Depending on where you live, you may have the right to access a copy of your
          data, correct it, delete it, object to or restrict processing, or receive it
          in a portable form. We honour these requests wherever we are able to,
          regardless of where you are.
        </p>
        <p>
          Email <a href={`mailto:${entity.supportEmail}`}>{entity.supportEmail}</a> from
          the address concerned, and we will respond within 30 days.
        </p>
        <div className="callout">
          <span className="callout__title">One limit worth stating up front</span>
          <p>
            Deleting the email attached to a purchase deletes the only link between you
            and your licence. We will do it if you ask — but you will not be able to
            recover that purchase afterwards, and we will confirm you understand that
            before proceeding.
          </p>
        </div>
        {governingLaw ? (
          <p>
            You also have the right to complain to the data protection authority in{" "}
            {governingLaw} or where you live.
          </p>
        ) : (
          <p>
            You also have the right to complain to the data protection authority where
            you live.
          </p>
        )}

        {/* ── Security ───────────────────────────────────────────────── */}
        <h2 id="p-security">Security</h2>
        <p>
          Traffic is encrypted in transit. Payment data is handled entirely by Stripe,
          a PCI-DSS Level 1 provider, and card numbers never reach our systems. Licence
          records are backed up regularly so that a failure on our side cannot cost you
          a purchase you paid for.
        </p>
        <p>
          No system is perfectly secure. If we ever suffer a breach affecting your data,
          we will tell you and the relevant regulator promptly rather than quietly.
        </p>
        <p>
          Found a security problem? Email{" "}
          <a href={`mailto:${entity.supportEmail}`}>{entity.supportEmail}</a> — we would
          much rather hear from you than not.
        </p>

        {/* ── Contact ────────────────────────────────────────────────── */}
        <h2 id="p-contact">Contact</h2>
        <p>
          <a href={`mailto:${entity.supportEmail}`}>{entity.supportEmail}</a>
          {entity.registeredName ? ` — ${entity.registeredName}` : ""}
          {entity.address ? `, ${entity.address}` : ""}.
        </p>
        <p>
          We may update this policy; the effective date above always reflects the
          current version, and material changes will be announced rather than slipped in.
        </p>
        <p>
          Related: <Link href="/terms">Terms of Service</Link> ·{" "}
          <Link href="/license">Template Licence</Link> ·{" "}
          <Link href="/refunds">Refund Policy</Link>
        </p>
      </div>

      <DocPager href="/privacy" />
    </DocShell>
  );
}

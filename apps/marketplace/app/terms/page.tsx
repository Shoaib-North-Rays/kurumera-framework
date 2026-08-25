import Link from "next/link";
import type { Metadata } from "next";
import { DocShell, DocPager, type TocItem } from "@/components/docs/DocShell";
import {
  LEGAL_EFFECTIVE, entity, governingLaw,
  PLATFORM_FEE_PCT, CREATOR_SHARE_PCT, LICENSE_SEATS,
  REFUND_WINDOW_DAYS, CURRENCY,
} from "@/lib/legal";
import "@/app/docs.css";

/**
 * Terms of Service.
 *
 * Replaces a 36-line page that was silent on liability, termination, acceptable
 * use, the creator relationship, the platform fee, the seat limit, and who the
 * buyer was contracting with. A marketplace taking card payments from strangers
 * needs an actual agreement, and this is one.
 *
 * Every number is interpolated from lib/legal.ts, which mirrors the enforcing
 * code — so the fee here cannot say 20% while push-service charges 25%.
 *
 * WHERE IT STAYS QUIET, THAT IS DELIBERATE. `entity.registeredName`,
 * `entity.address` and `governingLaw` are empty in lib/legal.ts because I do
 * not know them, and the clauses that need them are omitted rather than filled
 * with a guess. A contract naming the wrong company or the wrong court is worse
 * than one that does not name them at all. Fill those three values in and the
 * clauses appear here automatically.
 */
export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The agreement between you and Kurumera for using the marketplace, buying templates, and publishing them as a creator.",
  alternates: { canonical: "/terms" },
};

const TOC: TocItem[] = [
  { id: "c-about", label: "1. These terms" },
  { id: "c-defs", label: "2. Definitions" },
  { id: "c-account", label: "3. Your account" },
  { id: "c-market", label: "4. The marketplace" },
  { id: "c-buying", label: "5. Buying" },
  { id: "c-refunds", label: "6. Refunds" },
  { id: "c-selling", label: "7. Selling" },
  { id: "c-payments", label: "8. Payments" },
  { id: "c-use", label: "9. Acceptable use" },
  { id: "c-ip", label: "10. Intellectual property" },
  { id: "c-third", label: "11. Third-party content" },
  { id: "c-warranty", label: "12. Availability" },
  { id: "c-liability", label: "13. Liability" },
  { id: "c-term", label: "14. Suspension" },
  { id: "c-changes", label: "15. Changes" },
  { id: "c-contact", label: "16. Contact" },
];

export default function TermsPage() {
  return (
    <DocShell toc={TOC}>
      <header className="doc-hero">
        <p className="doc-hero__eyebrow">Legal</p>
        <h1>Terms of Service</h1>
        <p className="doc-hero__lede">
          The agreement between you and {entity.tradingName} for using this
          marketplace — as a visitor, as a buyer, and as a creator selling your work.
        </p>
        <div className="doc-hero__meta">
          <span>Effective {LEGAL_EFFECTIVE}</span>
          <span>Version 2.0</span>
        </div>
      </header>

      <div className="tldr">
        <p className="tldr__title">In plain English</p>
        <ul>
          <li>Buying a template gives you a licence to use it on up to {LICENSE_SEATS} of your own stores. It does not let you resell the template itself.</li>
          <li>Selling a template keeps your copyright. {entity.tradingName} takes {PLATFORM_FEE_PCT}% of each sale and you keep {CREATOR_SHARE_PCT}%.</li>
          <li>Templates are made by independent creators. We host and sell them; we did not write most of them.</li>
          <li>You can ask for a refund within {REFUND_WINDOW_DAYS} days if the template does not work as described.</li>
          <li>Behave, do not upload other people&rsquo;s work, and do not attack the service.</li>
        </ul>
        <p className="tldr__foot">
          This summary is for orientation only. The numbered terms below are the
          agreement, and they are what applies if the two ever differ.
        </p>
      </div>

      <div className="clauses">
        {/* 1 */}
        <section className="clause" id="c-about">
          <h2 className="clause__h">These terms</h2>
          <div className="clause__body">
            <div className="subclauses">
              <div className="subclause">
                <p>
                  These Terms of Service govern your use of the {entity.tradingName}{" "}
                  marketplace at marketplace.kurumera.com and the services reached
                  through it (the <strong>&ldquo;Service&rdquo;</strong>).
                  {entity.registeredName ? ` The Service is operated by ${entity.registeredName}${entity.companyNumber ? ` (company number ${entity.companyNumber})` : ""}${entity.address ? `, of ${entity.address}` : ""} ("we", "us").` : ` In these terms, "we" and "us" mean the operator of the Service, ${entity.tradingName}.`}
                </p>
              </div>
              <div className="subclause">
                <p>
                  By using the Service, creating an account, buying a template or
                  publishing one, you agree to these terms. If you do not agree, do
                  not use the Service.
                </p>
              </div>
              <div className="subclause">
                <p>
                  Additional terms apply to specific things you do: the{" "}
                  <Link href="/license">Template Licence</Link> governs what you may do
                  with a template you obtain, and the{" "}
                  <Link href="/refunds">Refund Policy</Link> governs refunds. Both form
                  part of this agreement.
                </p>
              </div>
              <div className="subclause">
                <p>
                  If you are agreeing on behalf of a company, you confirm you are
                  authorised to bind it, and &ldquo;you&rdquo; means that company.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 2 */}
        <section className="clause" id="c-defs">
          <h2 className="clause__h">Definitions</h2>
          <div className="clause__body">
            <ul>
              <li><strong>Template</strong> — a website theme or design listed on the Service, whether free or paid.</li>
              <li><strong>Creator</strong> — the person or company that publishes a Template.</li>
              <li><strong>Buyer</strong> — a person or company that obtains a Template.</li>
              <li><strong>Licence Key</strong> — the credential issued on purchase that authorises installation of a Template.</li>
              <li><strong>Store</strong> — a distinct storefront on which a Template is installed.</li>
            </ul>
          </div>
        </section>

        {/* 3 */}
        <section className="clause" id="c-account">
          <h2 className="clause__h">Your account</h2>
          <div className="clause__body">
            <div className="subclauses">
              <div className="subclause"><p>You must be at least 18, or old enough to enter a binding contract where you live, and must give accurate account information and keep it current.</p></div>
              <div className="subclause"><p>You are responsible for everything done through your account and for keeping your credentials and Licence Keys confidential. Tell us promptly at <a href={`mailto:${entity.supportEmail}`}>{entity.supportEmail}</a> if you believe your account has been compromised.</p></div>
              <div className="subclause">
                <p>
                  <strong>The email address matters.</strong> A Licence Key is bound to
                  the email address given at checkout, and that address is how you
                  retrieve the purchase later. If you buy under an address you do not
                  control, we may be unable to restore access to it.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4 */}
        <section className="clause" id="c-market">
          <h2 className="clause__h">What the marketplace is</h2>
          <div className="clause__body">
            <div className="subclauses">
              <div className="subclause"><p>The Service is a marketplace. It lists Templates published by independent Creators, and it handles discovery, payment, licence issuing and delivery.</p></div>
              <div className="subclause">
                <p>
                  <strong>We are not the author of most Templates and we are not the
                  seller of record.</strong> When you buy, you are buying the Creator&rsquo;s
                  work; we take a fee for operating the marketplace that made the sale
                  possible.
                </p>
              </div>
              <div className="subclause"><p>We do not warrant that any Template is suitable for your purpose. Preview it before you buy — every listing has a live preview for exactly this reason.</p></div>
              <div className="subclause"><p>We may change, add, or discontinue parts of the Service. We will not remove access to a Template you have already licensed except as clause 14 allows.</p></div>
            </div>
          </div>
        </section>

        {/* 5 */}
        <section className="clause" id="c-buying">
          <h2 className="clause__h">Buying a template</h2>
          <div className="clause__body">
            <div className="subclauses">
              <div className="subclause"><p>Prices are set by the Creator, shown in {CURRENCY}, and are the full amount charged. No tax is added at checkout — see <Link href="/docs/taxes">tax responsibilities</Link>.</p></div>
              <div className="subclause"><p>A purchase is complete when your payment is confirmed. A Licence Key is issued at that moment and is available from your <Link href="/purchases">purchases</Link>, whether or not you return to the site.</p></div>
              <div className="subclause">
                <p>
                  <strong>Immediate delivery.</strong> Templates are digital goods
                  delivered as soon as payment completes. By completing a purchase you
                  ask us to supply it immediately, and you acknowledge that where a
                  statutory cancellation period would otherwise apply, it may be lost
                  once delivery has begun. Your rights under the{" "}
                  <Link href="/refunds">Refund Policy</Link> are unaffected.
                </p>
              </div>
              <div className="subclause"><p>What a Licence Key permits — including its {LICENSE_SEATS}-store limit — is set out in the <Link href="/license">Template Licence</Link>.</p></div>
              <div className="subclause"><p>Free Templates are supplied under the same Licence, without payment. We may withdraw a free listing at any time; doing so does not remove a copy you have already installed.</p></div>
            </div>
          </div>
        </section>

        {/* 6 */}
        <section className="clause" id="c-refunds">
          <h2 className="clause__h">Refunds</h2>
          <div className="clause__body">
            <p>
              Refunds are governed by the <Link href="/refunds">Refund Policy</Link>,
              which forms part of these terms. In summary: you may request a refund
              within {REFUND_WINDOW_DAYS} days where a Template does not work as
              described. A refunded Licence Key is revoked and you must stop using the
              Template and remove it from your Stores.
            </p>
          </div>
        </section>

        {/* 7 */}
        <section className="clause" id="c-selling">
          <h2 className="clause__h">Selling as a creator</h2>
          <div className="clause__body">
            <div className="subclauses">
              <div className="subclause">
                <p>
                  <strong>You keep your copyright.</strong> Publishing does not transfer
                  ownership of your work to us.
                </p>
              </div>
              <div className="subclause">
                <p>
                  You grant us a non-exclusive, worldwide, royalty-free licence to host,
                  store, reproduce, adapt for display, publicly display and distribute
                  your Template, and to sub-licence it to Buyers on the terms of the{" "}
                  <Link href="/license">Template Licence</Link>. This licence exists so
                  we can run the marketplace and deliver what Buyers pay for, and for
                  no other purpose.
                </p>
              </div>
              <div className="subclause">
                <p>
                  We may use your Template&rsquo;s name, cover image and screenshots to
                  promote it and the marketplace.
                </p>
              </div>
              <div className="subclause">
                <p>You warrant that you own or are licensed to distribute everything you publish — including fonts, images, icons and third-party code — and that it does not infringe anyone&rsquo;s rights or contain anything malicious.</p>
              </div>
              <div className="subclause">
                <p>You are responsible for the accuracy of your listing and for supporting your Buyers within a reasonable time.</p>
              </div>
              <div className="subclause">
                <p>
                  <strong>Our fee is {PLATFORM_FEE_PCT}% of each sale;</strong> you
                  receive {CREATOR_SHARE_PCT}%, transferred at the point of sale to
                  your connected Stripe account. Stripe&rsquo;s own processing fees are
                  charged separately to you by Stripe. See{" "}
                  <Link href="/docs/payouts">getting paid</Link>.
                </p>
              </div>
              <div className="subclause">
                <p>
                  If a sale is fully refunded or disputed, the corresponding transfer is
                  reversed and the Buyer&rsquo;s licence is revoked.
                </p>
              </div>
              <div className="subclause">
                <p>
                  You may set and change your price and may unpublish a Template at any
                  time. Unpublishing stops new sales; it does not terminate licences
                  already issued, which survive.
                </p>
              </div>
              <div className="subclause">
                <p>Listing here is non-exclusive. You may sell the same work elsewhere.</p>
              </div>
              <div className="subclause">
                <p>
                  We may decline, remove, or delist a Template that breaches these terms
                  or the published listing requirements. Except where a listing is
                  causing active harm, we will tell you why and give you an opportunity
                  to respond.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 8 */}
        <section className="clause" id="c-payments">
          <h2 className="clause__h">Payments</h2>
          <div className="clause__body">
            <div className="subclauses">
              <div className="subclause"><p>Payments are processed by Stripe. We do not receive or store your full card details. Stripe&rsquo;s own terms apply to your use of it.</p></div>
              <div className="subclause"><p>Creator payouts are made through Stripe Connect to an account you control. You must complete Stripe&rsquo;s verification before funds can be routed to you.</p></div>
              <div className="subclause"><p>Each party is responsible for its own taxes. We do not calculate, collect or remit VAT, GST or sales tax on Template sales — see <Link href="/docs/taxes">tax responsibilities</Link>.</p></div>
              <div className="subclause"><p>You must not use the Service for fraudulent payments, and we may reverse a transaction and suspend an account where we reasonably suspect fraud.</p></div>
            </div>
          </div>
        </section>

        {/* 9 */}
        <section className="clause" id="c-use">
          <h2 className="clause__h">Acceptable use</h2>
          <div className="clause__body">
            <p>You must not:</p>
            <ul>
              <li>publish work that is not yours to distribute, or that infringes anyone&rsquo;s rights;</li>
              <li>upload anything containing malware, or code that exfiltrates store or customer data;</li>
              <li>misrepresent a Template in its listing, preview or cover;</li>
              <li>manipulate discovery, ratings or reviews, including through fake accounts or purchases;</li>
              <li>share, resell or publish a Licence Key, or attempt to circumvent licence checks;</li>
              <li>scrape the Service at a rate that degrades it, or attempt to breach its security;</li>
              <li>use the Service to harass anyone, or for anything unlawful where you or your Buyers are.</li>
            </ul>
          </div>
        </section>

        {/* 10 */}
        <section className="clause" id="c-ip">
          <h2 className="clause__h">Intellectual property</h2>
          <div className="clause__body">
            <div className="subclauses">
              <div className="subclause"><p>The Service itself — the marketplace, the builder, the CLI, the {entity.tradingName} name and logo — belongs to us or our licensors. Nothing here grants you rights in it beyond using the Service as intended.</p></div>
              <div className="subclause"><p>Templates belong to their Creators, licensed to you under the <Link href="/license">Template Licence</Link>.</p></div>
              <div className="subclause"><p>If you believe something here infringes your rights, email <a href={`mailto:${entity.legalEmail}`}>{entity.legalEmail}</a> identifying the work, the listing, and your basis for the claim. We investigate every report and remove infringing material.</p></div>
            </div>
          </div>
        </section>

        {/* 11 */}
        <section className="clause" id="c-third">
          <h2 className="clause__h">Third-party content and services</h2>
          <div className="clause__body">
            <p>
              Templates are third-party content and may themselves rely on third-party
              fonts, libraries or services with their own terms. We do not review every
              line of every Template, and we are not responsible for third-party content
              or services. Clause 13 sets out the limits of our liability.
            </p>
          </div>
        </section>

        {/* 12 */}
        <section className="clause" id="c-warranty">
          <h2 className="clause__h">Availability and warranties</h2>
          <div className="clause__body">
            <div className="subclauses">
              <div className="subclause"><p>We work to keep the Service available but do not guarantee uninterrupted or error-free operation. Maintenance, outages and third-party failures happen.</p></div>
              <div className="subclause"><p>Except as expressly stated in these terms and to the fullest extent the law allows, the Service and all Templates are provided <strong>&ldquo;as is&rdquo;</strong>, without warranties of any kind, including merchantability, fitness for a particular purpose and non-infringement.</p></div>
              <div className="subclause"><p>Nothing in these terms excludes or limits any right you have as a consumer that cannot lawfully be excluded.</p></div>
            </div>
          </div>
        </section>

        {/* 13 */}
        <section className="clause" id="c-liability">
          <h2 className="clause__h">Limitation of liability</h2>
          <div className="clause__body">
            <div className="subclauses">
              <div className="subclause"><p>To the fullest extent permitted by law, we are not liable for indirect, incidental, special or consequential loss, or for lost profits, revenue, goodwill or data, however caused.</p></div>
              <div className="subclause">
                <p>
                  To the fullest extent permitted by law, our total aggregate liability
                  arising out of or relating to the Service is limited to the greater of
                  the amounts you paid us in the twelve months before the claim, or
                  US$100.
                </p>
              </div>
              <div className="subclause"><p>We do not exclude liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot lawfully be excluded.</p></div>
              <div className="subclause"><p>You will indemnify us against claims arising from content you publish, from your breach of these terms, or from your unlawful use of the Service.</p></div>
            </div>
          </div>
        </section>

        {/* 14 */}
        <section className="clause" id="c-term">
          <h2 className="clause__h">Suspension and termination</h2>
          <div className="clause__body">
            <div className="subclauses">
              <div className="subclause"><p>You may stop using the Service at any time and may ask us to close your account.</p></div>
              <div className="subclause"><p>We may suspend or terminate access where you materially breach these terms, where required by law, or where continued access presents a security or fraud risk. We will give notice and an opportunity to put things right unless the circumstances make that inappropriate.</p></div>
              <div className="subclause">
                <p>
                  <strong>Licences you have already paid for survive termination of
                  your account</strong>, except where the licence itself was revoked
                  under the <Link href="/refunds">Refund Policy</Link> or was obtained
                  fraudulently.
                </p>
              </div>
              <div className="subclause"><p>Clauses 10, 12, 13 and 16 survive termination.</p></div>
            </div>
          </div>
        </section>

        {/* 15 */}
        <section className="clause" id="c-changes">
          <h2 className="clause__h">Changes to these terms</h2>
          <div className="clause__body">
            <p>
              We may update these terms. The effective date at the top always reflects
              the current version. Where a change materially reduces your rights or
              increases your obligations we will give reasonable advance notice — for
              Creators, that includes any increase in the platform fee. Continuing to
              use the Service after a change takes effect means you accept it.
            </p>
          </div>
        </section>

        {/* 16 */}
        <section className="clause" id="c-contact">
          <h2 className="clause__h">Contact{governingLaw ? " and governing law" : ""}</h2>
          <div className="clause__body">
            {governingLaw ? (
              <p>
                These terms are governed by the laws of {governingLaw}, and the courts
                of {governingLaw} have exclusive jurisdiction over any dispute, subject
                to any mandatory rights you have as a consumer to bring proceedings
                where you live.
              </p>
            ) : null}
            <p>
              Questions about these terms, or anything else:{" "}
              <a href={`mailto:${entity.legalEmail}`}>{entity.legalEmail}</a>.
              {entity.address ? ` Or write to us at ${entity.address}.` : ""}
            </p>
            <p>
              Related: <Link href="/license">Template Licence</Link> ·{" "}
              <Link href="/refunds">Refund Policy</Link> ·{" "}
              <Link href="/privacy">Privacy</Link>
            </p>
          </div>
        </section>
      </div>

      <DocPager href="/terms" />
    </DocShell>
  );
}

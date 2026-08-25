import Link from "next/link";
import type { Metadata } from "next";
import { DocShell, DocPager, type TocItem } from "@/components/docs/DocShell";
import { LEGAL_EFFECTIVE, entity, LICENSE_SEATS, REFUND_WINDOW_DAYS } from "@/lib/legal";
import "@/app/docs.css";

/**
 * The Template Licence.
 *
 * This document did not exist, and the old terms page covered the entire
 * question of what a buyer may do with a $300 purchase in three bullets. The
 * most consequential omission: the licence stops working at LICENSE_SEATS
 * stores — enforced at push-service.mjs:543, written down nowhere. A buyer
 * discovering a hard limit from an error message on their sixth store is a
 * refund and a bad review that were both entirely avoidable.
 *
 * ONE JUDGEMENT CALL, FLAGGED. Clause 3 permits building for clients, with each
 * client store consuming a seat. Nothing in the code distinguishes "your store"
 * from "your client's store" — it counts store slugs — so the permissive
 * reading is the one that matches what the software actually does, and agency
 * work is most of the market for a paid template. If the commercial intent is
 * to sell a separate, dearer extended licence for client work, this clause is
 * the one to change, and the seat counter would need to learn the difference.
 */
export const metadata: Metadata = {
  title: "Template licence",
  description: `What you may and may not do with a Kurumera template: a ${LICENSE_SEATS}-store licence, client work, modifications, and what is not permitted.`,
  alternates: { canonical: "/license" },
};

const TOC: TocItem[] = [
  { id: "l-grant", label: "1. What you get" },
  { id: "l-stores", label: "2. The store limit" },
  { id: "l-permitted", label: "3. What you may do" },
  { id: "l-restrictions", label: "4. What you may not" },
  { id: "l-ownership", label: "5. Ownership" },
  { id: "l-assets", label: "6. Fonts & images" },
  { id: "l-updates", label: "7. Updates & support" },
  { id: "l-free", label: "8. Free templates" },
  { id: "l-term", label: "9. Term & revocation" },
];

export default function LicensePage() {
  return (
    <DocShell toc={TOC}>
      <header className="doc-hero">
        <p className="doc-hero__eyebrow">Legal</p>
        <h1>Template licence</h1>
        <p className="doc-hero__lede">
          What a licence key actually entitles you to. One page, because you should
          be able to read the whole thing before you spend money.
        </p>
        <div className="doc-hero__meta">
          <span>Effective {LEGAL_EFFECTIVE}</span>
          <span>Applies to free and paid templates</span>
        </div>
      </header>

      <div className="factgrid">
        <div className="fact">
          <div className="fact__v">{LICENSE_SEATS}</div>
          <p className="fact__k">Stores you may install one licence on</p>
        </div>
        <div className="fact">
          <div className="fact__v">∞</div>
          <p className="fact__k">Re-installs on a store already covered</p>
        </div>
        <div className="fact">
          <div className="fact__v">Perpetual</div>
          <p className="fact__k">No renewal, no expiry, no subscription</p>
        </div>
      </div>

      <div className="tldr">
        <p className="tldr__title">In plain English</p>
        <ul>
          <li>You can use the template on up to {LICENSE_SEATS} stores, yours or your clients&rsquo;, and change it however you like.</li>
          <li>You can charge a client to build their site with it.</li>
          <li>You cannot resell, redistribute or re-publish the template itself, modified or not.</li>
          <li>The licence does not expire, and an update from the creator does not cost extra.</li>
        </ul>
        <p className="tldr__foot">
          The numbered terms below are the licence. This summary is not.
        </p>
      </div>

      <div className="clauses">
        {/* 1 */}
        <section className="clause" id="l-grant">
          <h2 className="clause__h">What you get</h2>
          <div className="clause__body">
            <div className="subclauses">
              <div className="subclause">
                <p>
                  On completing a purchase you receive a <strong>Licence Key</strong>{" "}
                  and, with it, a worldwide, non-exclusive, non-transferable,
                  perpetual licence to install, modify and use the Template as set out
                  below.
                </p>
              </div>
              <div className="subclause">
                <p>
                  The licence is granted by the Template&rsquo;s Creator and administered by{" "}
                  {entity.tradingName} on their behalf. It is a licence, not a sale of
                  the underlying work.
                </p>
              </div>
              <div className="subclause">
                <p>
                  Your Licence Key is bound to the email address given at checkout.
                  Keep it — it is what installs and re-installs the Template.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 2 */}
        <section className="clause" id="l-stores">
          <h2 className="clause__h">The store limit</h2>
          <div className="clause__body">
            <div className="subclauses">
              <div className="subclause">
                <p>
                  One Licence Key covers installation on up to{" "}
                  <strong>{LICENSE_SEATS} distinct stores</strong>. This is enforced by
                  the platform, not merely asked of you.
                </p>
              </div>
              <div className="subclause">
                <p>
                  A store is counted the first time you install the Template on it.{" "}
                  <strong>Re-installing on a store already covered is always free</strong>{" "}
                  and never consumes another seat — so reinstalling, restoring a backup
                  or moving between environments on the same store costs you nothing.
                </p>
              </div>
              <div className="subclause">
                <p>
                  Need more than {LICENSE_SEATS}? Buy another licence, or email{" "}
                  <a href={`mailto:${entity.supportEmail}`}>{entity.supportEmail}</a> and
                  we will arrange additional seats.
                </p>
              </div>
            </div>

            <div className="callout callout--note">
              <span className="callout__title">Worth knowing before you buy</span>
              <p>
                If you expect to deploy across more than {LICENSE_SEATS} stores — an
                agency running many clients, or a group with multiple brands — sort the
                seats out first. It is a much easier conversation before the sixth
                install than during it.
              </p>
            </div>
          </div>
        </section>

        {/* 3 */}
        <section className="clause" id="l-permitted">
          <h2 className="clause__h">What you may do</h2>
          <div className="clause__body">
            <ul>
              <li><strong>Install it</strong> on up to {LICENSE_SEATS} stores.</li>
              <li><strong>Modify it freely</strong> — layout, styling, code, content. There is no obligation to keep it recognisable.</li>
              <li><strong>Use it commercially.</strong> Sell whatever you like through a store running it, at any volume.</li>
              <li><strong>Build for clients.</strong> You may use the Template to build a store for a client and charge for that work. Each client store counts as one of your {LICENSE_SEATS}.</li>
              <li><strong>Transfer a finished store</strong> to the client who commissioned it, including the Template as installed on it. The client receives a working store; they do not receive this licence, and may not reuse the Template on further stores under your key.</li>
              <li><strong>Keep using it indefinitely.</strong> The licence does not expire and does not renew.</li>
            </ul>
          </div>
        </section>

        {/* 4 */}
        <section className="clause" id="l-restrictions">
          <h2 className="clause__h">What you may not do</h2>
          <div className="clause__body">
            <ul>
              <li><strong>Resell or redistribute the Template</strong>, in whole or in substantial part, whether modified or not, whether free or paid.</li>
              <li><strong>Publish it as your own</strong> on this or any other marketplace.</li>
              <li><strong>Share, sell or publish your Licence Key</strong>, or use one you did not obtain.</li>
              <li><strong>Circumvent licence checks</strong>, or the store limit.</li>
              <li><strong>Use it to build a template-generation product</strong> — a service that outputs sites derived from it to third parties.</li>
              <li><strong>Remove the Creator&rsquo;s copyright notices</strong> from the source, though you need not display any attribution on the resulting site.</li>
              <li><strong>Use it for anything unlawful</strong> where you or your buyers are.</li>
            </ul>
            <p>
              The distinction throughout is simple: <strong>you may use the Template
              as much as you like to build sites; you may not put the Template itself
              back into circulation.</strong>
            </p>
          </div>
        </section>

        {/* 5 */}
        <section className="clause" id="l-ownership">
          <h2 className="clause__h">Ownership</h2>
          <div className="clause__body">
            <div className="subclauses">
              <div className="subclause"><p>The Creator retains all copyright and other rights in the Template. Buying a licence does not transfer ownership.</p></div>
              <div className="subclause"><p>You own the content you add — your text, your photography, your products — and any original code you write on top.</p></div>
              <div className="subclause"><p>Your modifications are yours to the extent they are separable, but remain subject to the restrictions in clause 4. Modifying a Template does not make it redistributable.</p></div>
            </div>
          </div>
        </section>

        {/* 6 */}
        <section className="clause" id="l-assets">
          <h2 className="clause__h">Fonts, images and third-party assets</h2>
          <div className="clause__body">
            <div className="subclauses">
              <div className="subclause"><p>A Template may include or reference fonts, photography, icons or libraries licensed from third parties, each under its own terms.</p></div>
              <div className="subclause">
                <p>
                  <strong>Demo content is usually not included.</strong> Placeholder
                  photography shown in a preview is frequently licensed for the
                  demonstration only. Check what the listing says before assuming an
                  image is yours to publish.
                </p>
              </div>
              <div className="subclause"><p>Where a third-party licence conflicts with this one, the third-party licence governs that component.</p></div>
            </div>
          </div>
        </section>

        {/* 7 */}
        <section className="clause" id="l-updates">
          <h2 className="clause__h">Updates and support</h2>
          <div className="clause__body">
            <div className="subclauses">
              <div className="subclause"><p>Where a Creator publishes an updated version, your existing licence covers it. Updates do not cost extra and your key does not expire when a new version ships.</p></div>
              <div className="subclause"><p>Creators are not obliged to publish updates indefinitely, and a Template may stop being maintained.</p></div>
              <div className="subclause"><p>Support for a Template is provided by its Creator. {entity.tradingName} supports the marketplace itself — purchases, licence keys, installation and payment.</p></div>
              <div className="subclause"><p>Once you have modified a Template, an update may not apply cleanly to your copy. That is an ordinary consequence of clause 3, not a defect.</p></div>
            </div>
          </div>
        </section>

        {/* 8 */}
        <section className="clause" id="l-free">
          <h2 className="clause__h">Free templates</h2>
          <div className="clause__body">
            <p>
              Free Templates are licensed on these same terms, without payment and
              without a store limit. They come with no warranty and no obligation of
              support, and a free listing may be withdrawn at any time — which does not
              affect a copy you have already installed.
            </p>
          </div>
        </section>

        {/* 9 */}
        <section className="clause" id="l-term">
          <h2 className="clause__h">Term and revocation</h2>
          <div className="clause__body">
            <div className="subclauses">
              <div className="subclause"><p>The licence starts when your Licence Key is issued and continues indefinitely unless revoked under this clause.</p></div>
              <div className="subclause">
                <p>
                  A Licence Key is <strong>revoked automatically</strong> when the
                  purchase is fully refunded or a payment dispute is raised. On
                  revocation you must stop using the Template and remove it from your
                  stores. See the <Link href="/refunds">Refund Policy</Link> — refunds
                  are available within {REFUND_WINDOW_DAYS} days.
                </p>
              </div>
              <div className="subclause"><p>We may revoke a key obtained fraudulently, or one being used in material breach of clause 4.</p></div>
              <div className="subclause"><p>Aside from those cases, your licence is not revoked because you closed your account, because the Creator unpublished the Template, or because a newer version was released.</p></div>
            </div>
          </div>
        </section>
      </div>

      <div className="prose">
        <hr />
        <p>
          Questions before you buy are always welcome:{" "}
          <a href={`mailto:${entity.supportEmail}`}>{entity.supportEmail}</a>.
        </p>
        <p>
          Related: <Link href="/terms">Terms of Service</Link> ·{" "}
          <Link href="/refunds">Refund Policy</Link>
        </p>
      </div>

      <DocPager href="/license" />
    </DocShell>
  );
}

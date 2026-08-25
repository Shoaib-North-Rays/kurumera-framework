import Link from "next/link";
import type { Metadata } from "next";
import { DocShell, DocPager, type TocItem } from "@/components/docs/DocShell";
import { BUILDER_ORIGIN } from "@/lib/registry";
import { CREATOR_SHARE_PCT, LICENSE_SEATS, LEGAL_EFFECTIVE } from "@/lib/legal";
import "@/app/docs.css";

/**
 * How to build a template and get it listed.
 *
 * EVERY command on this page was read out of `packages/cli/src/bin.ts` — the
 * help text and the routing table — not recalled or inferred. A guide that
 * documents a command that does not exist is worse than no guide, because the
 * reader blames themselves first and support second.
 *
 * Both publishing paths are covered because both exist and neither is a
 * second-class citizen: a builder design and a code theme land on the same
 * listing page and a buyer cannot tell which is which.
 */
export const metadata: Metadata = {
  title: "Build & publish a template",
  description: "Step-by-step: build a template visually or as a Next.js theme, test it against a real store, price it, and publish it to the Kurumera marketplace.",
  alternates: { canonical: "/docs/creator-guide" },
};

const TOC: TocItem[] = [
  { id: "before", label: "Before you start" },
  { id: "visual", label: "Path A — the editor" },
  { id: "code", label: "Path B — a code theme" },
  { id: "test", label: "Test it properly" },
  { id: "listing", label: "Prepare the listing" },
  { id: "publish", label: "Publish" },
  { id: "after", label: "After it is live" },
  { id: "rejected", label: "What gets removed" },
];

/** One place for the command strings so a rename is a one-line diff. */
const Cmd = ({ children }: { children: React.ReactNode }) => <code>{children}</code>;

function Term({ label, lines }: { label: string; lines: { t: string; c?: boolean }[] }) {
  return (
    <div className="term">
      <div className="term__bar">{label}</div>
      <pre>
        <code>
          {lines.map((l, i) => (
            <span key={i} className={l.c ? "tok-cmt" : undefined}>
              {l.t}
              {i < lines.length - 1 ? "\n" : ""}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

export default function CreatorGuide() {
  return (
    <DocShell toc={TOC}>
      <header className="doc-hero">
        <p className="doc-hero__eyebrow">Creator guide</p>
        <h1>Build and publish a template</h1>
        <p className="doc-hero__lede">
          Two ways in — a visual editor and a Next.js theme you write yourself.
          This walks both, from an empty canvas to a listing people can buy, and
          is accurate to CLI v0.9.x.
        </p>
        <div className="doc-hero__meta">
          <span>Last reviewed {LEGAL_EFFECTIVE}</span>
          <span>~12 minute read</span>
        </div>
      </header>

      <div className="prose">
        {/* ── Before ─────────────────────────────────────────────────── */}
        <h2 id="before">Before you start</h2>
        <p>
          You need a Kurumera account and at least one store to develop against.
          The store is not what you sell — it is the live data your template runs
          on while you build it, so the layouts meet real products, real prices
          and a real cart rather than placeholder text.
        </p>
        <p>
          You will also need a Stripe account connected before you can be paid.
          You can publish without it, but the money has nowhere to go.{" "}
          <Link href="/docs/payouts">Connect Stripe first</Link> — it takes a few
          minutes and it is the step people skip and then chase.
        </p>

        <div className="callout callout--note">
          <span className="callout__title">Which path should I take?</span>
          <p>
            If you would rather not open a terminal, take the editor. If you want
            version control, a build step and your own components, take the code
            theme. They produce the same kind of listing and earn the same{" "}
            {CREATOR_SHARE_PCT}%.
          </p>
        </div>

        {/* ── Path A ─────────────────────────────────────────────────── */}
        <h2 id="visual">Path A — build it in the editor</h2>
        <p>
          The builder is a visual canvas bound to live commerce data. Sections drop
          onto a page, bind to a collection or a product, and render with your real
          catalogue while you work.
        </p>

        <div className="steps">
          <div className="step">
            <h3 className="step__title">Open the builder and start a theme</h3>
            <div className="step__body">
              <p>
                Go to <a href={BUILDER_ORIGIN}>{BUILDER_ORIGIN.replace(/^https?:\/\//, "")}</a>{" "}
                and create a theme. Every store keeps one live theme and as many
                drafts as you like, so you can build without touching what is
                currently published.
              </p>
            </div>
          </div>
          <div className="step">
            <h3 className="step__title">Lay out the pages a store actually needs</h3>
            <div className="step__body">
              <p>
                At minimum: a home page, a collection listing, a product page, cart
                and search. A template missing a product page is not a template a
                buyer can use, however good the home page looks.
              </p>
            </div>
          </div>
          <div className="step">
            <h3 className="step__title">Design for width, not for devices</h3>
            <div className="step__body">
              <p>
                Use the responsive preview to check 320, 768 and 1280. Layout intent
                compiles to fluid CSS, so you are setting behaviour across a range
                rather than pinning three fixed breakpoints.
              </p>
            </div>
          </div>
          <div className="step">
            <h3 className="step__title">Publish it as a marketplace listing</h3>
            <div className="step__body">
              <p>
                From the theme menu, publish to the marketplace. A cover screenshot
                is captured for you from the rendered draft, so what a buyer sees on
                the card is genuinely your template rather than a mockup.
              </p>
            </div>
          </div>
        </div>

        {/* ── Path B ─────────────────────────────────────────────────── */}
        <h2 id="code">Path B — build it as a Next.js theme</h2>
        <p>
          A code theme is a Next.js app that satisfies Kurumera&rsquo;s route contract.
          You develop it locally against a real store, push it to be built, and
          publish versioned releases.
        </p>

        <h3>Install the CLI</h3>
        <Term
          label="Terminal"
          lines={[
            { t: "npm install -g @kurumera/cli" },
            { t: "kurumera login" },
            { t: "" },
            { t: "# On a server, in CI, or from an AI agent with no browser:", c: true },
            { t: "kurumera login --device --wait" },
          ]}
        />

        <h3>Scaffold and run it</h3>
        <p>
          <Cmd>theme dev</Cmd> runs your theme against the live data of a store you
          have access to — the same products a buyer will point it at.
        </p>
        <Term
          label="Terminal"
          lines={[
            { t: "kurumera theme init my-theme" },
            { t: "cd my-theme" },
            { t: "kurumera theme dev --store your-store" },
          ]}
        />

        <h3>Check, push, preview</h3>
        <p>
          <Cmd>theme check</Cmd> validates the route contract and the safety rules
          before anything leaves your machine. Fix what it reports — a theme that
          fails the contract will not build.
        </p>
        <Term
          label="Terminal"
          lines={[
            { t: "kurumera theme check" },
            { t: "kurumera theme push          " , c: false },
            { t: "kurumera theme preview --store your-store" },
          ]}
        />

        <h3>Publish it to the marketplace</h3>
        <p>
          <Cmd>theme publish</Cmd> makes a build live on <em>your own</em> store.{" "}
          <Cmd>marketplace publish</Cmd> is the different, deliberate step that lists
          it for other people. Do the first, confirm it works, then do the second.
        </p>
        <Term
          label="Terminal"
          lines={[
            { t: "kurumera theme publish --store your-store       " , c: false },
            { t: "# ...confirm it works on your own store, then:", c: true },
            { t: "kurumera marketplace publish --store your-store" },
          ]}
        />

        <div className="callout">
          <span className="callout__title">Useful afterwards</span>
          <ul>
            <li><Cmd>kurumera marketplace mine --store &lt;slug&gt;</Cmd> — your listings</li>
            <li><Cmd>kurumera marketplace update &lt;theme&gt; --price 79 --tags fashion,minimal</Cmd> — edit one</li>
            <li><Cmd>kurumera marketplace unpublish &lt;theme&gt;</Cmd> — delist it</li>
            <li><Cmd>kurumera theme versions --store &lt;slug&gt;</Cmd> — every retained build</li>
            <li><Cmd>kurumera theme rollback --store &lt;slug&gt;</Cmd> — undo a bad release</li>
          </ul>
        </div>

        {/* ── Test ───────────────────────────────────────────────────── */}
        <h2 id="test">Test it properly before you list it</h2>
        <p>
          Most refund requests are not about taste. They are about a template that
          was never run against a real catalogue. Before publishing, walk it:
        </p>
        <ul>
          <li>A collection with <strong>one</strong> product, and one with fifty. Both must look deliberate.</li>
          <li>A product with a long title, no image, and five variants.</li>
          <li>An empty cart, a full cart, and the checkout hand-off.</li>
          <li>Search with no results.</li>
          <li>320px wide. Nothing may overlap and the page must not scroll sideways.</li>
        </ul>

        <div className="callout callout--warn">
          <span className="callout__title">The empty state is the one that gets you</span>
          <p>
            A grid that looks superb with twelve products and broken with one is the
            single most common reason a buyer asks for their money back. Design the
            sparse case on purpose.
          </p>
        </div>

        {/* ── Listing ────────────────────────────────────────────────── */}
        <h2 id="listing">Prepare the listing</h2>
        <p>
          The listing is what sells the work. Four fields do most of it.
        </p>

        <div className="dtable-wrap">
          <table className="dtable">
            <caption className="sr-only">Listing fields and what makes each one work</caption>
            <thead>
              <tr><th scope="col">Field</th><th scope="col">What works</th></tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Name</th>
                <td>Short and distinctive. Buyers scan a grid of cards — a name that describes a category rather than a template disappears in it.</td>
              </tr>
              <tr>
                <th scope="row">Description</th>
                <td>What kind of store it suits, what is included, what makes it different. Lead with the first two; the third is what closes it.</td>
              </tr>
              <tr>
                <th scope="row">Category &amp; tags</th>
                <td>How people actually find you. Pick the one true category and three to five honest tags — tag stuffing gets a listing removed, not ranked.</td>
              </tr>
              <tr>
                <th scope="row">Cover</th>
                <td>Rendered at 1280×900 and cropped to fill. Keep the important part of the design away from the extreme edges.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 id="pricing">Pricing it</h3>
        <p>
          You set the price and you can change it whenever you like. Free is a
          legitimate strategy — a free template with your name on it is the cheapest
          distribution you will ever get.
        </p>
        <p>
          Look at what comparable templates list for before you decide, and price the
          work rather than the hours. What you receive on each sale is{" "}
          {CREATOR_SHARE_PCT}% of the list price; the arithmetic is laid out on{" "}
          <Link href="/sell">the earnings page</Link>.
        </p>

        {/* ── Publish ────────────────────────────────────────────────── */}
        <h2 id="publish">Publish</h2>
        <p>
          Publishing puts the listing on the public marketplace. Builder designs are
          reviewed before they appear. Code themes published through the CLI go live
          immediately — which is faster, and means the responsibility for what you
          list is entirely yours.
        </p>
        <p>
          What a buyer gets is a licence key covering installation on up to{" "}
          <strong>{LICENSE_SEATS} of their own stores</strong>, and re-installing on a
          store already covered never consumes another seat. The full grant is in the{" "}
          <Link href="/license">template licence</Link>.
        </p>

        {/* ── After ──────────────────────────────────────────────────── */}
        <h2 id="after">After it is live</h2>
        <h3>Updates</h3>
        <p>
          Publish a new version the same way you published the first. Buyers keep
          access to the template they bought — a licence is not a subscription, and
          it does not expire when you ship an update.
        </p>
        <h3>Support</h3>
        <p>
          Buyers will email you about your template. Answer them. The reviews on your
          listing are the thing that sells the next copy, and a template with an
          absent creator earns exactly the reviews you would expect.
        </p>
        <h3>Refunds</h3>
        <p>
          When a refund is issued, the buyer&rsquo;s licence is revoked automatically and
          the sale is reversed out of your balance. The{" "}
          <Link href="/refunds">refund policy</Link> sets out when one is due.
        </p>

        {/* ── Removal ────────────────────────────────────────────────── */}
        <h2 id="rejected">What gets a listing removed</h2>
        <p>
          Rare, and never a surprise — you will hear from us first unless the listing
          is causing active harm.
        </p>
        <ul>
          <li>Work that is not yours to sell, or that redistributes someone else&rsquo;s licensed assets.</li>
          <li>A preview or cover that shows something the buyer does not receive.</li>
          <li>A template that does not install, or that breaks a store&rsquo;s checkout.</li>
          <li>Code that exfiltrates store or customer data, or that phones home.</li>
          <li>Tags or a category chosen to game discovery rather than to describe the work.</li>
        </ul>
        <p>
          Believe a removal was wrong? Reply to the notice — it goes to a person.
        </p>
      </div>

      <DocPager href="/docs/creator-guide" />
    </DocShell>
  );
}

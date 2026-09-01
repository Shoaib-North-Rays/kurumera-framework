import Link from "next/link";
import type { Metadata } from "next";
import { Arrow, Bolt, Check, Shield, Layers } from "@/components/Icons";
import { Reveal, RevealGroup, RevealLines } from "@/components/motion/Reveal";
import { BUILDER_ORIGIN } from "@/lib/registry";
import { CREATOR_SHARE_PCT, PLATFORM_FEE_PCT, LICENSE_SEATS, CURRENCY } from "@/lib/legal";
import "@/app/docs.css";   /* .steps, .callout, .dtable — shared with the guides */
import "@/app/sell.css";

/**
 * The creator front door.
 *
 * There was no way in. `/creator` is the signed-in dashboard — it opens with
 * "Manage your templates", which is useless to someone who has never published
 * one — and the footer's "For creators" pointed at it. So the entire acquisition
 * path for the supply side of a marketplace was a dashboard for people who had
 * already arrived.
 *
 * Everything quantitative on this page comes from `lib/legal.ts`, which mirrors
 * the enforcing code. The revenue share is not a marketing number I chose; it
 * is `PLATFORM_FEE_PCT` from push-service.mjs:246 subtracted from 100.
 */
export const metadata: Metadata = {
  title: "Sell your templates",
  description: `Publish website templates on Kurumera and keep ${CREATOR_SHARE_PCT}% of every sale. Build visually or in code, set your own price, get paid through Stripe.`,
  alternates: { canonical: "/sell" },
  openGraph: {
    title: "Sell your templates on Kurumera",
    description: `Keep ${CREATOR_SHARE_PCT}% of every sale. Build visually or in code, set your own price, get paid through Stripe.`,
    url: "https://marketplace.kurumera.com/sell",
    /* Declared explicitly. Naming an `openGraph` object here stopped the root
       opengraph-image attaching, so this page went out with NO image at all —
       and `twitter` fell back to the site defaults, so sharing the creator
       recruitment page produced a large-image card with no image and the
       marketplace's generic blurb. */
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Sell your templates on Kurumera" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sell your templates on Kurumera",
    description: `Keep ${CREATOR_SHARE_PCT}% of every sale. Build visually or in code, set your own price, get paid through Stripe.`,
    images: ["/opengraph-image"],
  },
};

/** Worked examples, computed — never hand-typed, so they cannot drift. */
const PRICE_POINTS = [29, 79, 149, 300];
const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const REQUIREMENTS = [
  { t: "It works on a real store", d: "Installed against live data — products, collections, cart, checkout — not a screenshot of a design." },
  { t: "It is responsive", d: "Legible and usable from 320px up. Nothing overlaps, nothing scrolls sideways." },
  { t: "The listing is honest", d: "The cover and preview show the template a buyer receives, with no mocked-up content they cannot produce." },
  { t: "You have the rights", d: "Fonts, photography and icons are yours to redistribute, or are licensed for it." },
];

const FAQ = [
  {
    q: "What does it cost to list?",
    a: `Nothing. There is no listing fee, no subscription and no monthly minimum. Kurumera takes ${PLATFORM_FEE_PCT}% of a sale, and only when there is a sale.`,
  },
  {
    q: "Who sets the price?",
    a: `You do, in ${CURRENCY}, and you can change it whenever you like from the creator dashboard or the CLI. You can also publish a template for free.`,
  },
  {
    q: "Do I keep ownership of my work?",
    a: "Yes. You keep the copyright. Publishing grants Kurumera the licence it needs to host, display and distribute the template to buyers, and nothing beyond that.",
  },
  {
    q: "What happens if a buyer refunds?",
    a: "The licence is revoked automatically when Stripe reports a full refund or a dispute, and the sale is reversed out of your balance. Partial refunds leave the licence in place.",
  },
  {
    q: "Can I sell the same template elsewhere?",
    a: "Yes. Listing here is not exclusive. You are free to sell the same work on your own site or another marketplace.",
  },
];

export default function SellPage() {
  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="sell-hero">
        <div className="wrap sell-hero__inner">
          <div className="sell-hero__copy">
            <Reveal variant="fade">
              <span className="eyebrow">Sell on Kurumera</span>
            </Reveal>
            <RevealLines
              as="h1"
              className="sell-hero__h"
              lines={["Design it once.", "Sell it a thousand times."]}
            />
            <Reveal variant="up" className="sell-hero__lede">
              <p>
                Publish a template to the Kurumera marketplace and keep{" "}
                <strong>{CREATOR_SHARE_PCT}% of every sale</strong>. Build it visually in
                the editor or write it as a Next.js theme in your own repo — both
                publish to the same storefront.
              </p>
            </Reveal>
            <Reveal variant="fade" className="sell-hero__acts">
              <a className="btn btn--primary btn--lg mi-arrow" href={`${BUILDER_ORIGIN}`}>
                Start building <Arrow />
              </a>
              <Link className="btn btn--secondary btn--lg" href="/docs/creator-guide">
                Read the creator guide
              </Link>
            </Reveal>
            <Reveal variant="fade">
              <p className="sell-hero__fine">
                No listing fee · No subscription · Paid out through Stripe
              </p>
            </Reveal>
          </div>

          {/* The split, drawn. The single most important number on the page,
              so it gets the visual weight rather than sitting in a sentence. */}
          <Reveal variant="scale" className="sell-hero__viz" aria-hidden>
            <div className="splitviz">
              <div className="splitviz__bar">
                <div className="splitviz__you" style={{ inlineSize: `${CREATOR_SHARE_PCT}%` }}>
                  <span className="splitviz__pct">{CREATOR_SHARE_PCT}%</span>
                  <span className="splitviz__who">You keep</span>
                </div>
                <div className="splitviz__us" style={{ inlineSize: `${PLATFORM_FEE_PCT}%` }}>
                  <span className="splitviz__pct">{PLATFORM_FEE_PCT}%</span>
                  <span className="splitviz__who">Platform</span>
                </div>
              </div>
              <p className="splitviz__cap">
                Hosting, previews, licence delivery, payment processing and support
                come out of the platform share.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Two ways to build ──────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap">
          <div className="section__head">
            <Reveal variant="up">
              <h2 className="section__title">Two ways to build. One marketplace.</h2>
              <p className="section__sub">
                Pick whichever you already work in. A buyer cannot tell the difference,
                and both land on the same listing page.
              </p>
            </Reveal>
          </div>

          <RevealGroup className="ways">
            <Reveal variant="up" className="way">
              <span className="way__icon"><Layers /></span>
              <h3 className="way__t">Visually, in the editor</h3>
              <p className="way__d">
                Drag sections onto a canvas, bind them to live products, and publish
                the result as a template. No repository, no build step, no terminal.
              </p>
              <ul className="way__list">
                <li><Check /> Live commerce data while you design</li>
                <li><Check /> Responsive layout intent, not fixed breakpoints</li>
                <li><Check /> Cover screenshots generated for you</li>
              </ul>
              <a className="way__cta mi-arrow" href={BUILDER_ORIGIN}>
                Open the builder <Arrow />
              </a>
            </Reveal>

            <Reveal variant="up" className="way">
              <span className="way__icon"><Bolt /></span>
              <h3 className="way__t">In code, as a Next.js theme</h3>
              <p className="way__d">
                Scaffold a theme, run it against a real store&rsquo;s data, and publish
                versioned builds from the CLI. Your editor, your Git history.
              </p>
              <ul className="way__list">
                <li><Check /> <code>kurumera theme dev</code> against live data</li>
                <li><Check /> Versioned publishes with one-command rollback</li>
                <li><Check /> Contract check before anything ships</li>
              </ul>
              <Link className="way__cta mi-arrow" href="/docs/creator-guide#code">
                Read the CLI guide <Arrow />
              </Link>
            </Reveal>
          </RevealGroup>
        </div>
      </section>

      {/* ── What you earn ──────────────────────────────────────────────── */}
      <section className="section sell-earn">
        <div className="wrap">
          <div className="section__head">
            <Reveal variant="up">
              <h2 className="section__title">What you actually take home</h2>
              <p className="section__sub">
                Kurumera&rsquo;s {PLATFORM_FEE_PCT}% is deducted at the point of sale. Stripe&rsquo;s own
                processing fee is charged separately by Stripe against your connected
                account, so the figures below are before that.
              </p>
            </Reveal>
          </div>

          <Reveal variant="up">
            <div className="dtable-wrap">
              <table className="dtable">
                <caption className="sr-only">
                  Creator earnings at four example list prices
                </caption>
                <thead>
                  <tr>
                    <th scope="col">List price</th>
                    <th scope="col" className="num">Platform {PLATFORM_FEE_PCT}%</th>
                    <th scope="col" className="num">You receive</th>
                    <th scope="col" className="num">10 sales</th>
                    <th scope="col" className="num">100 sales</th>
                  </tr>
                </thead>
                <tbody>
                  {PRICE_POINTS.map((p) => {
                    const fee = (p * PLATFORM_FEE_PCT) / 100;
                    const keep = p - fee;
                    return (
                      <tr key={p}>
                        <th scope="row">{money(p)}</th>
                        <td className="num">−{money(fee)}</td>
                        <td className="num"><strong>{money(keep)}</strong></td>
                        <td className="num">{money(keep * 10)}</td>
                        <td className="num">{money(keep * 100)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Reveal>

          <Reveal variant="fade">
            <p className="sell-earn__note">
              Illustrative prices, not a forecast — you set your own. See{" "}
              <Link href="/docs/payouts">getting paid</Link> for how and when the money
              reaches you, and <Link href="/docs/taxes">tax responsibilities</Link> for
              what you are responsible for declaring.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap sell-steps">
          <div className="section__head">
            <Reveal variant="up">
              <h2 className="section__title">From idea to listed</h2>
            </Reveal>
          </div>

          <RevealGroup className="steps">
            {[
              { t: "Build it", d: <>Design in the editor, or scaffold a theme with <code>kurumera theme init</code> and develop against a real store.</> },
              { t: "Test it on a real store", d: <>Install it, add products, walk the cart and the checkout. A template that has never held real data will not survive a buyer&rsquo;s.</> },
              { t: "Connect Stripe", d: <>One onboarding flow, run by Stripe. You cannot be paid until this is finished, so do it before you publish rather than after your first sale.</> },
              { t: "Publish and price it", d: <>Set a name, description, category, tags and a price. Publishing is instant, and you can change any of it afterwards.</> },
            ].map((s) => (
              <Reveal variant="up" key={s.t} className="step">
                <h3 className="step__title">{s.t}</h3>
                <div className="step__body"><p>{s.d}</p></div>
              </Reveal>
            ))}
          </RevealGroup>

          <Reveal variant="fade">
            <div className="callout callout--note">
              <span className="callout__title">One licence, {LICENSE_SEATS} stores</span>
              <p>
                A buyer&rsquo;s licence covers installation on up to {LICENSE_SEATS} of their own
                stores. Re-installing on a store already covered is always free. It is
                worth knowing what you are selling — buyers ask.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Requirements ───────────────────────────────────────────────── */}
      <section className="section sell-req">
        <div className="wrap">
          <div className="sell-req__grid">
            <Reveal variant="up" className="sell-req__intro">
              <span className="eyebrow">Before you publish</span>
              <h2 className="section__title">What a listing has to clear</h2>
              <p className="section__sub">
                Short list, applied evenly. It exists so a buyer can trust the preview
                they are looking at — which is the only thing that makes the next
                person&rsquo;s template sell too.
              </p>
              <Link className="btn btn--secondary" href="/terms">
                Read the full terms
              </Link>
            </Reveal>

            <RevealGroup className="sell-req__list">
              {REQUIREMENTS.map((r) => (
                <Reveal variant="up" key={r.t} className="reqitem">
                  <span className="reqitem__tick"><Check /></span>
                  <div>
                    <h3 className="reqitem__t">{r.t}</h3>
                    <p className="reqitem__d">{r.d}</p>
                  </div>
                </Reveal>
              ))}
            </RevealGroup>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="wrap sell-faq">
          <div className="section__head">
            <Reveal variant="up">
              <h2 className="section__title">Questions creators ask</h2>
            </Reveal>
          </div>
          <RevealGroup className="sell-faq__list">
            {FAQ.map((f) => (
              <Reveal variant="up" key={f.q} className="sfaq">
                <h3 className="sfaq__q">{f.q}</h3>
                <p className="sfaq__a">{f.a}</p>
              </Reveal>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ── Close ──────────────────────────────────────────────────────── */}
      <section className="sell-close">
        <div className="wrap sell-close__inner">
          <RevealLines as="h2" className="sell-close__h" lines={["Ready when", "you are."]} />
          <Reveal variant="fade" className="sell-close__acts">
            <a className="btn btn--primary btn--lg mi-arrow" href={BUILDER_ORIGIN}>
              Start building <Arrow />
            </a>
            <Link className="btn btn--secondary btn--lg" href="/docs/creator-guide">
              <Shield /> Read the guide first
            </Link>
          </Reveal>
          <Reveal variant="fade">
            <p className="sell-close__fine">
              Already published? Your listings, prices and earnings live in the{" "}
              <Link href="/creator">creator dashboard</Link>.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Structured data, built from the same FAQ constant rendered above so the
          markup cannot disagree with the visible page. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
    </>
  );
}

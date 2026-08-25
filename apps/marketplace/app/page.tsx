import Link from "next/link";
import "./home.css";
import "./wall.css";
import "./hero.css";
import "./stage.css";
import "./ai.css";
import { Hero } from "@/components/Hero";
import { EditorialWall } from "@/components/EditorialWall";
import { BuilderStage } from "@/components/BuilderStage";
import { AiStage } from "@/components/AiStage";
import {
  fetchTemplates, categoryCounts, CATEGORIES, isFree, isBuilder, priceLabel,
  featureLabels, categoryLabel, builderPreviewUrl, BUILDER_ORIGIN, type Template,
} from "@/lib/registry";
import { LivePreview } from "@/components/LivePreview";
import { Reveal, RevealGroup, RevealLines } from "@/components/motion/Reveal";
import { Arrow } from "@/components/Icons";
import { SearchForm } from "@/components/SearchForm";

/* ─────────────────────────────────────────────────────────────────────────────
   HOME — an index, not a catalogue front.

   WHAT THE DATA ACTUALLY SUPPORTS (measured against the live registry, not
   assumed). Eight published templates. Three installs in total across all of
   them. Eight authors, one template each. Four free, four paid ($10–$300).
   Four of the twelve categories are empty. Three of the eight descriptions are
   empty strings. Every template does now have a real 1280×900 cover screenshot
   — that changed in 290ed5f, which extended cover capture to code themes.

   Everything on this page is derived from those facts, and the sections that
   could only be filled by inventing something are gone rather than padded:

     · The stats band. "3 installs" is not social proof, and dressing it up as
       "Trusted by creators" is the exact failure the brief names.
     · "Trending templates". Nothing with a maximum of one install is trending.
     · "Free templates" as a separate row. It repeated four of the same eight
       listings under a second heading; price is now on every index entry and
       /templates/free is one link away.
     · The use-case grid. It declared three columns and rendered one card,
       because two of its three categories resolve to nothing.
     · The spotlight. "Most installed" means one install.
     · The top-creators grid. Eight avatars each reading "1 template".
     · The six-icon "Blazing fast / SEO ready" grid. Six unverifiable claims.
     · Install counts anywhere on the page.

   What replaces them is one complete index of all eight, because at this size
   showing everything is both the honest move and the stronger composition.
   ───────────────────────────────────────────────────────────────────────────── */

/** Spelled-out counts read as editorial; digits read as a dashboard. Falls back
 *  to digits past twenty, where the word is longer than the number it saves. */
const WORDS = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty",
];
const numWord = (n: number) => (n >= 0 && n < WORDS.length ? WORDS[n] : String(n));
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "A, B or C" — used for the empty-category invitation. */
function listWords(xs: string[]): string {
  if (xs.length <= 1) return xs[0] || "";
  return `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`;
}

/**
 * Tag labels, filtered.
 *
 * featureLabels() is the site-wide helper and stays authoritative, but one live
 * listing carries the tag ": real-estate", which it renders verbatim as
 * ": Real-estate". A stray leading colon reads as a rendering bug at this type
 * size, so anything that is not a clean word is dropped rather than repaired —
 * inventing a label the creator did not write would be worse.
 */
const CLEAN_TAG = /^[A-Za-z][A-Za-z0-9 &+-]*$/;
const cleanTags = (t: Template, limit = 3) => featureLabels(t, limit + 2).filter((x) => CLEAN_TAG.test(x)).slice(0, limit);

const FAQ = [
  {
    q: "How do I use a template I get from Kurumera?",
    a: "Every template has a live preview, so you know exactly what you're getting before you decide. Free templates install and customize right away; paid templates unlock with a license key issued after checkout, which you'll use to install and clone the source into the visual builder.",
  },
  {
    q: "How does pricing and checkout work?",
    a: "Each creator sets their own template's price — free or paid, shown up front before you buy. Payments are handled by Stripe. Keep your license key after a purchase; you'll need it if you ever reinstall the template.",
  },
  {
    q: "What can I do with a template once I own it?",
    a: "Install it, customize it fully in the visual builder, and publish it live on your own domain. What you build is yours.",
  },
  {
    q: "Can I sell my own templates on Kurumera?",
    a: "Yes — publish through the creator dashboard. You keep ownership of your work and set your own price; the marketplace lists it for others to install under the platform's terms.",
  },
];

export default async function HomePage() {
  const templates = await fetchTemplates();
  const counts = categoryCounts(templates);

  const total = templates.length;
  const freeCount = templates.filter(isFree).length;
  const paid = templates.filter((t) => !isFree(t));
  const prices = paid.map((t) => t.price).sort((a, b) => a - b);
  // Only templates with a real cover belong in an image-led band; a fallback
  // tile among screenshots reads as a gap rather than a design choice.
  const withCovers = templates.filter((t) => !!t.coverImage);
  const creatorCount = new Set(templates.map((t) => t.author)).size;
  // Real, summed from the registry the page already fetched — no extra request.
  const totalViews = templates.reduce((n, t) => n + (t.views || 0), 0);
  const ratingCount = templates.reduce((n, t) => n + (t.rating?.count || 0), 0);
  const ratingAverage = ratingCount
    ? Math.round((templates.reduce((n, t) => n + (t.rating?.average || 0) * (t.rating?.count || 0), 0) / ratingCount) * 10) / 10
    : 0;

  const filledCats = CATEGORIES.filter((c) => (counts[c.key] || 0) > 0);
  const emptyCats = CATEGORIES.filter((c) => !(counts[c.key] || 0));
  // Chips have to lead somewhere real — the old ones offered "Dark portfolio"
  // and "One-page landing pages", both of which return nothing.
  const chips = filledCats.slice().sort((a, b) => (counts[b.key] || 0) - (counts[a.key] || 0)).slice(0, 5);

  const headline = total
    ? [`${numWord(total)} ${plural(total, "template", "templates")}.`, "Open every one", "before you decide."]
    : ["The marketplace", "is warming up.", "Nothing published yet."];

  const priceRange = prices.length === 0 ? ""
    : prices.length === 1 ? `The one paid template is $${prices[0]}.`
    : `The paid ones run from $${prices[0]} to $${prices[prices.length - 1]}.`;

  const creatorHead = emptyCats.length
    ? [`${numWord(emptyCats.length)} ${plural(emptyCats.length, "category", "categories")}`, plural(emptyCats.length, "is still empty.", "are still empty.")]
    : ["Publish your", "own template."];

  return (
    <>
      <Hero
        templates={templates}
        freeCount={freeCount}
        paidCount={paid.length}
        creatorCount={creatorCount}
        filledCategories={filledCats.length}
        totalCategories={CATEGORIES.length}
        lowestPaid={prices.length > 0 ? prices[0] : null}
        totalViews={totalViews}
        ratingCount={ratingCount}
        ratingAverage={ratingAverage}
        chips={chips.map((c) => ({ key: c.key, label: c.label }))}
      />

      {/* ── 1a · THE STAGE ───────────────────────────────────────────────────
          Between "here is the marketplace" and "here is the catalogue", the one
          thing neither of them says: what the editor actually does. Shown
          rather than described — this section's own copy sits inside the
          builder's selection outline. */}
      <BuilderStage />

      {/* ── 1b · GENERATION ──────────────────────────────────────────────────
          The stage says every part of a page is editable. This says you do not
          have to start from an empty one. */}
      <AiStage templates={templates} />

      {/* ── 1b · THE SHOWCASE ────────────────────────────────────────────────
          Imagery leads, then the index gives the full list in text. This band
          only became possible when the covers were fixed: before that every
          listing had coverImage:"" and a visual showcase would have been eight
          live iframes. */}
      {withCovers.length >= 4 && <EditorialWall templates={withCovers} />}

      {/* ── 3 · CATEGORIES · dense, wide, right-aligned metadata ─────────────
          Was: eyebrow + two-line h2 on the left, a wrapped list on the right —
          the same shape as the three sections that followed it. Four bands in a
          row with one composition is the single loudest "generated" signal a
          page can carry, louder than any margin.

          So this one is now the DENSE band: full ruled rows running the wide
          measure, name left, count right, no display heading at all. Names and
          real counts only — a thumbnail here would be one member's screenshot
          standing in for a category that holds one template. */}
      {filledCats.length > 0 && (
        <section className="hm-band hm-band--surface hm-band--ruled">
          <div className="wrap wrap--wide hm-cats">
            <div className="hm-cats__bar">
              <Reveal as="h2" variant="fade" className="hm-label">Browse by industry</Reveal>
              <Reveal as="span" variant="fade" className="hm-label hm-label--q">
                {filledCats.length} of {CATEGORIES.length} categories in use
              </Reveal>
            </div>
            <RevealGroup className="hm-cats__rows">
              {filledCats.map((c) => (
                <Reveal as={Link} variant="fade" key={c.key} className="hm-catrow" href={`/templates/category/${c.key}`}>
                  <span className="hm-catrow__name">{c.label}</span>
                  <span className="hm-catrow__c">
                    {counts[c.key]} {plural(counts[c.key], "template", "templates")}
                  </span>
                  <span className="hm-catrow__a" aria-hidden><Arrow /></span>
                </Reveal>
              ))}
            </RevealGroup>
          </div>
        </section>
      )}

      {/* ── 4 · STATEMENT · the page's one loud moment ────────────────────────
          Stacked, not side-by-side: the claim runs at display size across the
          whole measure, then a rule, then the substantiation and the actions
          beneath it at opposite ends of the grid. Changing the ORIENTATION is
          what makes this read as a different section rather than the dark
          repaint of the one above. */}
      <section className="hm-band hm-band--ink">
        <div className="wrap hm-stmt">
          <Reveal as="span" variant="fade" className="hm-eyebrow">What you are buying</Reveal>
          <RevealLines as="h2" className="hm-stmt__h hm-lines" lines={["No mockups.", "No lock-in."]} />
          <div className="hm-stmt__foot hm-grid">
            <Reveal as="p" variant="fade" className="hm-lede hm-stmt__copy">
              Every listing is a site that already runs — a Next.js theme or a visual-builder design, not a picture of one.
              Open its live preview before you decide. Free templates install straight away; paid ones unlock with a license
              key you keep. Either way you customize it in the builder and publish it on your own domain.
            </Reveal>
            <Reveal variant="fade" className="hm-actions hm-stmt__act">
              <Link className="btn btn--primary btn--lg mi-arrow" href="/templates">Browse templates <Arrow /></Link>
              <a className="btn btn--secondary btn--lg" href={BUILDER_ORIGIN}>Start from scratch</a>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 5 · FAQ · the quiet one ───────────────────────────────────────────
          Narrower than everything around it, and the axis is reversed — answers
          at column 1, the heading rail at column 9. After the full-width
          statement above, a band that is visibly narrower reads as a pause;
          a band at the same width would just read as more page. */}
      <section className="hm-band hm-band--page">
        <div className="wrap wrap--editorial hm-faq">
          <div className="hm-grid">
            <RevealGroup className="hm-faq__list faq">
              {FAQ.map((f) => (
                <Reveal as="details" variant="fade" key={f.q} className="fgroup">
                  <summary>{f.q}</summary>
                  <div className="fgroup__body"><p>{f.a}</p></div>
                </Reveal>
              ))}
            </RevealGroup>
            <div className="hm-faq__rail">
              <Reveal as="span" variant="fade" className="hm-eyebrow">FAQ</Reveal>
              <RevealLines as="h2" className="hm-h3 hm-lines" lines={["Questions,", "answered."]} />
              <Reveal as="p" variant="fade" className="hm-faq__note">Anything not covered here reaches a real person.</Reveal>
              <Reveal variant="fade">
                <a className="hm-more mi-link" href="mailto:support@kurumera.com">support@kurumera.com</a>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6 · CREATOR · a compact strip, not another full band ──────────────
          The empty categories are the honest argument for publishing, so the
          page closes on them by name instead of on a creator headcount. Set as
          one horizontal strip: after two tall bands the rhythm needs something
          thin before the footer, or the bottom of the page is three equal
          blocks in a row. */}
      <section className="hm-band hm-band--mint hm-band--ruled">
        <div className="wrap hm-creator">
          <div className="hm-creator__row">
            <div className="hm-creator__head">
              <Reveal as="span" variant="fade" className="hm-eyebrow">Become a creator</Reveal>
              <RevealLines as="h2" className="hm-h3 hm-lines" lines={creatorHead} />
            </div>
            <Reveal as="p" variant="fade" className="hm-creator__lede">
              {emptyCats.length
                // Phrased with the categories AFTER the noun: several labels
                // are already plural ("Landing Pages"), so "a landing pages
                // template" would be ungrammatical for some of the set.
                ? `Nothing has been published under ${listWords(emptyCats.map((c) => c.label.toLowerCase()))} yet. The first template in a category gets it to itself.`
                : "Publish through the creator dashboard and your template is listed for the whole marketplace to find."}
            </Reveal>
            <Reveal variant="fade" className="hm-creator__act">
              <Link className="btn btn--primary mi-arrow" href="/creator">Open the creator dashboard <Arrow /></Link>
              <span className="hm-creator__terms">
                You set the price and keep ownership of your work.
              </span>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}

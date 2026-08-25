import Image from "next/image";
import Link from "next/link";

/**
 * THE STAGE — the page's own headline, shown mid-edit.
 *
 * The section between "here is the marketplace" (hero) and "here is the
 * catalogue" (wall) has one job: say what the thing actually does. It does that
 * by demonstrating rather than describing — the copy you are reading sits
 * inside the builder's own selection outline, surrounded by the pieces of the
 * editor that produced it. The claim and the evidence are the same object.
 *
 * CHOREOGRAPHY, in the order the eye should travel (delays in STEPS below):
 *   1 · media + swatches arrive on the left      — "you start with something"
 *   2 · the picker cards arrive on the right     — "you choose"
 *   3 · the copy writes itself in                — "it becomes a page"
 *   4 · the outline DRAWS around it, tab last    — "and all of it is editable"
 *   5 · the surrounding panels settle
 *
 * Step 4 is the point of the whole section, which is why it is last and why the
 * line draws rather than fades: a finished border reads as decoration, a drawn
 * one reads as an action someone just took.
 *
 * Sequencing is done with explicit per-element `--reveal-delay`, NOT with
 * `data-reveal-group`. The group mechanism staggers by DOM order, and this
 * composition needs clusters that are far apart in the markup to fire together
 * (the two right-hand cards) while clusters that are adjacent fire apart. Note
 * that `applyStagger` in lib/motion.ts only writes `--reveal-delay` for
 * elements inside a group, so nothing here overwrites these values.
 */

/** One timeline, so the order is readable in one place and stays consistent. */
const STEPS = {
  media: 0,
  swatches: 240,
  pick1: 420,
  pick2: 520,
  pick3: 620,
  eyebrow: 900,
  headline: 1020,
  lede: 1240,
  outline: 1520,
  tab: 2000,
  cta: 2140,
  fineprint: 2260,
  layers: 2360,
  cart: 2460,
} as const;

const delay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as React.CSSProperties;

/**
 * Colour options for the jacket the panel sits on — the two it is actually
 * made of, then three alternatives.
 *
 * These were the brand's own green tokens at first, which was wrong twice
 * over: five values from one hue read as a broken gradient rather than a set
 * of choices, and a swatch row floating on a product means variants, not
 * theme settings. The chrome carries the brand; the merchandise carries its
 * own colour.
 */
const SWATCHES = [
  { hex: "#A9D5C4", name: "Sage" },
  { hex: "#C9A9E9", name: "Lilac" },
  { hex: "#F2E9DC", name: "Bone" },
  { hex: "#E3A6A1", name: "Clay" },
  { hex: "#2F3A36", name: "Charcoal" },
];

/**
 * The supplied product cut-outs. Every one is a transparent PNG, so each needs
 * a ground of its own — `contain` on a dark card would leave the product
 * floating in a hole. The grounds are pastels pulled from each product's own
 * colours, which is what keeps a mint jacket and a holographic board from
 * fighting: the chrome stays green, the merchandise brings its own light.
 */
const SHOTS = {
  jacket: { src: "/stage-jacket.png", ground: "#B9CFC4", alt: "" },
  board: { src: "/stage-board.png", ground: "#F0E2EC", alt: "" },
  shoe: { src: "/stage-shoe.png", ground: "#E6E3F7", alt: "" },
  boot: { src: "/stage-boot.png", ground: "#EDF0EE", alt: "" },
  jar: { src: "/stage-jar.png", ground: "#CFE7DC", alt: "" },
} as const;

type ShotKey = keyof typeof SHOTS;

function Shot({ name, sizes, priority }: { name: ShotKey; sizes: string; priority?: boolean }) {
  const s = SHOTS[name];
  return (
    <span className="stg__shot" style={{ background: s.ground }}>
      <Image className="stg__img" src={s.src} alt={s.alt} fill sizes={sizes} priority={priority} />
    </span>
  );
}

export function BuilderStage() {
  return (
    <section className="stg" aria-labelledby="stg-title">
      {/* Decorative grid. Its own layer so nothing in the composition has to
          carry a background image. */}
      <span className="stg__grid" aria-hidden />

      <div className="stg__inner">
        {/* ── 1 · LEFT: media + the theme's palette ───────────────────────── */}
        <div className="stg__media" data-reveal="scale" style={delay(STEPS.media)}>
          <Shot name="jacket" sizes="(max-width: 1180px) 15vw, 260px" priority />
        </div>

        {/* A SIBLING of the media card, not a child. The card clips its own
            corners, and this panel is meant to overhang it — nested, it lost
            two of its five swatches to `overflow: hidden`. */}
        <div className="stg__swatches" data-reveal="fade" style={delay(STEPS.swatches)} aria-hidden>
          {SWATCHES.map((s) => (
            <span key={s.hex} className="stg__swatch" style={{ background: s.hex }} title={s.name} />
          ))}
        </div>

        {/* ── 2 · RIGHT: the picker ───────────────────────────────────────── */}
        <div className="stg__picks" aria-hidden>
          {(["board", "shoe", "boot"] as ShotKey[]).map((name, i) => (
            <div
              key={name}
              className="stg__pick"
              data-reveal="scale"
              style={delay([STEPS.pick1, STEPS.pick2, STEPS.pick3][i])}
            >
              <span className={`stg__check${i === 0 ? " is-on" : ""}`} />
              <span className="stg__pick-frame">
                <Shot name={name} sizes="(max-width: 1180px) 10vw, 160px" />
              </span>
            </div>
          ))}
        </div>

        {/* ── 3 + 4 · THE COPY, AND THE LINE THAT CLAIMS IT ───────────────── */}
        <div className="stg__stage">
          <div className="stg__frame">
            {/* The outline is an SVG so the line can genuinely DRAW. No
                viewBox: without one, user units are CSS pixels, so the rect can
                be sized in percentages and its corner radius stays a true 8px
                instead of being stretched by preserveAspectRatio. pathLength=1
                normalises the perimeter, so the dash animation is identical
                whatever the box measures at this breakpoint. */}
            <svg className="stg__outline" data-reveal="fade" style={delay(STEPS.outline)} aria-hidden focusable="false">
              <rect className="stg__outline-rect" pathLength={1} x="1" y="1" rx="8" ry="8" />
            </svg>

            <span className="stg__tab" data-reveal="scale" style={delay(STEPS.tab)} aria-hidden>
              Heading
            </span>

            <p className="stg__eyebrow" data-reveal="fade" style={delay(STEPS.eyebrow)}>
              Kurumera website builder
            </p>

            <h2 className="stg__title" id="stg-title">
              <span className="stg__line" data-reveal="mask" style={delay(STEPS.headline)}>
                Every pixel,
              </span>{" "}
              <span className="stg__line" data-reveal="mask" style={delay(STEPS.headline + 140)}>
                yours to move.
              </span>
            </h2>

            <p className="stg__lede" data-reveal="fade" style={delay(STEPS.lede)}>
              Start from a template, then change anything — sections, colour, type, the lot —
              in an editor that shows you the real page while you work.
            </p>
          </div>

          <Link className="stg__cta" href="/templates" data-reveal="fade" style={delay(STEPS.cta)}>
            Start building free
            <span className="stg__cta-arrow" aria-hidden>→</span>
          </Link>

          <p className="stg__fineprint" data-reveal="fade" style={delay(STEPS.fineprint)}>
            Free templates to start with. Pay only when you want a paid one.
          </p>
        </div>

        {/* ── 5 · THE PANELS ──────────────────────────────────────────────── */}
        <div className="stg__layers" data-reveal="scale" style={delay(STEPS.layers)} aria-hidden>
          <div className="stg__layers-head">Home page</div>
          <div className="stg__layers-body">
            <span className="stg__group">Header</span>
            <span className="stg__row"><i className="stg__caret">›</i><i className="stg__ico" />Header</span>
            <span className="stg__row stg__row--add"><i className="stg__plus">+</i>Add section</span>
            <hr className="stg__rule" />
            <span className="stg__group">Template</span>
            <span className="stg__row"><i className="stg__caret is-open">›</i><i className="stg__ico is-media" />Image banner</span>
            <span className="stg__row stg__row--child"><i className="stg__ico is-text">T</i>Every pixel, yours to move.</span>
          </div>
        </div>

        <div className="stg__cart" data-reveal="scale" style={delay(STEPS.cart)} aria-hidden>
          <span className="stg__cart-shot">
            <Shot name="jar" sizes="(max-width: 1180px) 15vw, 240px" />
          </span>
          <span className="stg__cart-foot">
            <span className="stg__cart-bars">
              <i /><i />
            </span>
            <span className="stg__cart-btn">Add to cart</span>
          </span>
        </div>
      </div>
    </section>
  );
}

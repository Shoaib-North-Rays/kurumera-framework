import Link from "next/link";
import { BUILDER_ORIGIN, type Template } from "@/lib/registry";

/**
 * AI GENERATION — describe the store, get a first draft.
 *
 * Sits after the stage (KM-11): that section says every part of a page is
 * editable, this one says you do not have to start from an empty one.
 *
 * The claim it makes is the one worth making, and it is specific: generation is
 * grounded in the merchant's real catalogue, and it lands as a DRAFT. Both
 * matter more than "AI-powered" does — the first is why the output is usable,
 * the second is why trying it is safe.
 *
 * THE PROMPT BAR IS A LINK, NOT AN INPUT. It looks like a field because that is
 * what the composition needs, but a text box that silently discards what you
 * type into it is worse than no text box. It is an anchor with its own
 * accessible name, and the example prompt inside it is illustrative — it shows
 * what you would write, in the place you would write it. Wiring it to a real
 * generation endpoint is separate work.
 */

/** Example prompt. Concrete and small on purpose: "a store for my business"
 *  demonstrates nothing, and the specificity is the point of the feature. */
const EXAMPLE = "a calm, minimal store for hand-poured candles";

function Sparkle({ className }: { className: string }) {
  // Four-pointed star, drawn as one curve per quadrant so the points stay
  // needle-sharp at any size — a polygon of the same shape goes blunt.
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden focusable="false">
      <path d="M50 0C50 27 73 50 100 50 73 50 50 73 50 100 50 73 27 50 0 50 27 50 50 27 50 0Z" />
    </svg>
  );
}

export function AiStage({ templates }: { templates: Template[] }) {
  // The poster is a real storefront, which is also the graceful failure: if the
  // video source is missing or fails, browsers keep the poster on screen, so
  // this degrades to a still preview rather than a black rectangle.
  const poster = templates.find((t) => !!t.coverImage)?.coverImage;

  return (
    <section className="ai" aria-labelledby="ai-title">
      <div className="ai__head">
        <h2 className="ai__title" id="ai-title" data-reveal="mask">
          Build a store by describing it
        </h2>
        <p className="ai__lede" data-reveal="fade">
          <Link className="ai__lede-link" href={`${BUILDER_ORIGIN}/`}>
            Generate a first draft
          </Link>{" "}
          from your own catalogue — real products, real prices — then edit every
          section of it yourself.
        </p>
      </div>

      <div className="ai__panel" data-reveal="scale">
        <span className="ai__aurora" aria-hidden />
        <span className="ai__mesh" aria-hidden />

        {/* The prompt bar. An anchor: see the note at the top of this file. */}
        <Link
          className="ai__prompt"
          href={`${BUILDER_ORIGIN}/`}
          aria-label="Start building with AI in the Kurumera builder"
        >
          <Sparkle className="ai__prompt-spark" />
          <span className="ai__prompt-text">
            {EXAMPLE}
            <i className="ai__caret" aria-hidden />
          </span>
          <span className="ai__send" aria-hidden>
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </Link>

        {/* Layouts being drafted either side of the finished one. Dashed,
            because a dashed box is the one shape that reads as "not decided
            yet" without needing a caption. */}
        <span className="ai__ghost ai__ghost--l" aria-hidden>
          <i /><i /><i />
        </span>
        <span className="ai__ghost ai__ghost--r" aria-hidden>
          <i /><i /><i />
        </span>

        <div className="ai__screen">
          {/*
            AUTOPLAY, AND NO CONTROLS AT ALL.

            `muted` and `playsInline` are not stylistic — without both, mobile
            Safari and Chrome refuse to autoplay and the panel silently shows a
            frozen poster instead. `controls` is absent rather than false, and
            the two attributes below remove the pieces of chrome that survive
            even when the control bar is gone: the picture-in-picture button and
            the overflow menu's download / playback-speed items.

            `poster` is the graceful failure described at the top of the file.
          */}
          <video
            className="ai__video"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            disablePictureInPicture
            controlsList="nodownload noplaybackrate noremoteplayback"
            poster={poster}
            aria-hidden
            tabIndex={-1}
          >
            <source src="/ai-preview.webm" type="video/webm" />
            <source src="/ai-preview.mp4" type="video/mp4" />
          </video>
        </div>

        <Sparkle className="ai__spark ai__spark--1" />
        <Sparkle className="ai__spark ai__spark--2" />
        <Sparkle className="ai__spark ai__spark--3" />
      </div>
    </section>
  );
}

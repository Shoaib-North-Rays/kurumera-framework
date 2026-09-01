"use client";

import { useState } from "react";
import { Desktop, Tablet, Mobile, Expand } from "@/components/Icons";

const WIDTHS = { desktop: "100%", tablet: "768px", mobile: "390px" } as const;
type Device = keyof typeof WIDTHS;

/**
 * The live-preview stage shared by code themes and builder designs.
 *
 * WHY THE POSTER EXISTS.
 *
 * Preview containers scale to zero. Measured on production: a code theme whose
 * container had been reaped takes ~2.9s to cold-start (woodora, first hit 2.87s,
 * then 0.24s warm) on top of the page's own ~1.4s. For that whole time the stage
 * was an EMPTY WHITE BOX — the most important element on the page, blank, on the
 * page where someone decides whether to spend $300. Nothing was broken; there
 * was simply nothing to look at.
 *
 * The cover screenshot is already rendered, already cached, and already used on
 * every card. Showing it immediately means the visitor sees the template at
 * once, and the live frame fades in over it when it is genuinely ready. The wait
 * still happens; it just stops being visible.
 *
 * Two deliberate details:
 *   · If the iframe never loads — an upstream that stays down — the poster
 *     STAYS. A picture of the template is a better failure than an empty frame,
 *     and it is honest: the caption still says the frame below is the live one.
 *   · The poster never takes pointer events, so it cannot intercept a click
 *     meant for the frame during the crossfade.
 *
 * This component is shared rather than copied into both preview types, because
 * the two were byte-identical apart from the URL and a fix applied to one would
 * quietly not apply to the other.
 */
export function PreviewStage({
  url,
  name,
  cover,
}: {
  url: string;
  name: string;
  /** The listing's cover screenshot, shown until the live frame is ready. */
  cover?: string;
}) {
  const [device, setDevice] = useState<Device>("desktop");
  const [ready, setReady] = useState(false);

  const dev: [Device, typeof Desktop, string][] = [
    ["desktop", Desktop, "Desktop"],
    ["tablet", Tablet, "Tablet"],
    ["mobile", Mobile, "Mobile"],
  ];

  return (
    <div className="pdp__left">
      <div className="pdp__toolbar">
        <div className="pdp__devices" role="group" aria-label="Preview device">
          {dev.map(([key, Icon, label]) => (
            <button
              key={key}
              aria-label={label}
              aria-pressed={device === key}
              onClick={() => setDevice(key)}
            >
              <Icon />
            </button>
          ))}
        </div>
        <a className="btn btn--secondary pdp__open" href={url} target="_blank" rel="noreferrer">
          <Expand /> Full screen
        </a>
      </div>

      <div className="pdp__stage">
        <div className="pdp__device" style={{ width: WIDTHS[device] }}>
          <iframe
            src={url}
            title={`${name} live preview`}
            /* eager, not lazy: this is the point of the page and it is above the
               fold, so there is nothing to defer — and every millisecond earlier
               the request goes out is a millisecond earlier a cold container
               starts booting. */
            loading="eager"
            onLoad={() => setReady(true)}
          />

          {!ready && (
            <div className="dp-poster" aria-hidden={cover ? undefined : true}>
              {cover ? (
                /* Plain <img>, not next/image: this is a same-URL, already-warm
                   asset the card grid has loaded, and routing it through the
                   optimiser would add a second fetch to the very wait this is
                   meant to hide. */
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt={`${name} — preview loading`} />
              ) : (
                <div className="dp-poster__blank" />
              )}
              <span className="dp-poster__tag">
                <span className="dp-poster__dot" /> Starting live preview…
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Announced once, quietly, so a screen-reader user knows the frame is
          still arriving rather than wondering if it is empty. */}
      <p role="status" className="sr-only">
        {ready ? `${name} live preview is ready.` : `Starting the live preview of ${name}…`}
      </p>
    </div>
  );
}

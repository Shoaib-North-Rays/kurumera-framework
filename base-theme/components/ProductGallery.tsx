"use client";

import { useState } from "react";

/**
 * The product's gallery: pictures and videos, in the order the merchant set.
 *
 * A video never loads with the page. It shows its cover (or the first picture)
 * with a play button, and only when the shopper presses play does the
 * provider's player load — a YouTube or Vimeo iframe costs hundreds of KB and
 * sets the provider's own state, which nobody should pay for just by opening a
 * product. An uploaded video plays in a plain <video>.
 *
 * Items are prepared on the server (see galleryItems in the product page), so
 * this component never sees the API's shapes.
 */
export type GalleryItem =
  | { kind: "image"; id: string; src: string; alt: string }
  | {
      kind: "video"; id: string; title: string;
      /** Cover picture; may be empty. */
      poster: string;
      /** A YouTube / Vimeo link: the provider's own player. Empty for an upload. */
      embedUrl: string;
      /** An upload: the file and its type. Empty for a link. */
      src: string; mimeType: string;
    };

export function ProductGallery({ items, title }: { items: GalleryItem[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const current = items[index];

  const select = (i: number) => { setIndex(i); setPlaying(false); };

  return (
    <div className="pdp__gallery">
      <div className="pdp__media">
        {!current ? (
          <div className="pdp__media--empty" aria-hidden="true" />
        ) : current.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.src} alt={current.alt || title} />
        ) : playing ? (
          current.embedUrl ? (
            <iframe
              src={withAutoplay(current.embedUrl)}
              title={current.title || `${title} — video`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <video src={current.src} poster={current.poster || undefined} controls autoPlay playsInline>
              {current.mimeType ? <source src={current.src} type={current.mimeType} /> : null}
            </video>
          )
        ) : (
          <button type="button" className="pdp__poster" onClick={() => setPlaying(true)}
            aria-label={`Play video${current.title ? `: ${current.title}` : ""}`}>
            {current.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.poster} alt="" />
            ) : null}
            <span className="pdp__play" aria-hidden="true"><PlayIcon size={28} /></span>
          </button>
        )}
      </div>

      {items.length > 1 ? (
        <div className="pdp__thumbs" role="list">
          {items.map((item, i) => {
            const picture = item.kind === "image" ? item.src : item.poster;
            const label = item.kind === "image"
              ? item.alt || `Picture ${i + 1}`
              : item.title ? `Video: ${item.title}` : `Video ${i + 1}`;
            return (
              <button key={item.id} type="button" role="listitem" className="pdp__thumb"
                aria-label={label} aria-current={i === index ? "true" : undefined} onClick={() => select(i)}>
                {picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={picture} alt="" />
                ) : null}
                {item.kind === "video" ? <span className="pdp__thumb-play" aria-hidden="true"><PlayIcon size={14} /></span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** The player starts as soon as it loads — the shopper already pressed play. */
function withAutoplay(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}autoplay=1`;
}

function PlayIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

"use client";

import { useRef, useState } from "react";
import { categoryLabel, isBuilder, type Template } from "@/lib/registry";

/**
 * The factual half of the detail page.
 *
 * ONLY HONEST TABS. No reviews, no "pages included", no changelog — the
 * registry returns none of that, and a tab that renders invented content is
 * worse than a page with three tabs. What is here is: the creator's own prose,
 * the record the registry holds, and the release list.
 *
 * Two things the previous version got wrong and this one fixes:
 *
 *  1. DESCRIPTIONS HAVE PARAGRAPHS. The registry stores real newlines — the
 *     two long descriptions (Woodora, Aurevia) are multi-paragraph — and
 *     rendering the whole thing inside a single <p> collapsed them into one
 *     grey slab. They are split on blank lines, and the first paragraph is
 *     promoted to a lede.
 *
 *  2. THREE OF SEVEN TEMPLATES HAVE NO DESCRIPTION AT ALL. That case gets an
 *     explicit, plain statement instead of an empty pane or filler copy.
 */

type TabKey = "overview" | "details" | "versions";

/** Split on blank lines. Never on single newlines — a soft-wrapped sentence is
 *  not a paragraph, and splitting there shreds the two long descriptions. */
function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function DetailTabs({ t }: { t: Template }) {
  const [tab, setTab] = useState<TabKey>("overview");
  const listRef = useRef<HTMLDivElement>(null);

  const builder = isBuilder(t);
  const paras = paragraphs(t.description);
  const versions = t.versions.length ? t.versions : [t.latest];

  const tabs: [TabKey, string][] = [
    ["overview", "Overview"],
    ["details", "Details"],
    ["versions", `Versions (${versions.length})`],
  ];

  /** Arrow-key roving between tabs — the expected behaviour for role="tablist",
   *  and the reason each button carries an explicit tabIndex below. */
  function onKeyDown(e: React.KeyboardEvent) {
    const i = tabs.findIndex(([k]) => k === tab);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    setTab(tabs[next][0]);
    listRef.current?.querySelectorAll("button")[next]?.focus();
  }

  return (
    <div>
      <div className="dt-list" role="tablist" aria-label="Template information" ref={listRef} onKeyDown={onKeyDown}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            id={`dt-tab-${key}`}
            className="dt-tab"
            role="tab"
            type="button"
            aria-selected={tab === key}
            aria-controls={`dt-pane-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* The pane is keyed so switching tabs replays the entrance in detail.css.
          Keying a leaf pane is safe — the live preview iframes live in a
          different subtree and are never re-mounted by this. */}
      {tab === "overview" && (
        <div className="dt-pane" key="overview" id="dt-pane-overview" role="tabpanel" aria-labelledby="dt-tab-overview" tabIndex={-1}>
          {paras.length > 0 ? (
            paras.map((p, i) => (
              <p key={i} className={i === 0 ? "dt-lead" : undefined}>
                {p}
              </p>
            ))
          ) : (
            <p className="dt-nodesc">
              {t.author} has not written a description for this template yet. The live preview above is
              the honest version of one — it is the real published site, not a screenshot.
            </p>
          )}

          <h3 className="dt-sub">What you can do with it</h3>
          <ul className="dt-points">
            <li>Install it into your store and publish it to your own domain.</li>
            <li>Edit every page in the Kurumera visual builder — no code needed.</li>
            {!builder && <li>Or clone the source and change it as a normal Next.js project.</li>}
            {versions.length > 1 && (
              <li>
                Pin any of its {versions.length} published releases, or track the latest at v{t.latest}.
              </li>
            )}
          </ul>
        </div>
      )}

      {tab === "details" && (
        <div className="dt-pane" key="details" id="dt-pane-details" role="tabpanel" aria-labelledby="dt-tab-details" tabIndex={-1}>
          <dl className="dt-spec">
            <dt>Creator</dt>
            <dd>{t.author}</dd>

            {t.category && (
              <>
                <dt>Category</dt>
                <dd>{categoryLabel(t.category)}</dd>
              </>
            )}

            {t.tags.length > 0 && (
              <>
                <dt>Tags</dt>
                <dd>{t.tags.join(", ")}</dd>
              </>
            )}

            <dt>Format</dt>
            <dd>{builder ? "Visual builder template" : "Next.js code theme"}</dd>

            <dt>Current release</dt>
            <dd>v{t.latest}</dd>

            <dt>Builder compatibility</dt>
            <dd>Kurumera visual builder + code themes</dd>
          </dl>
        </div>
      )}

      {tab === "versions" && (
        <div className="dt-pane" key="versions" id="dt-pane-versions" role="tabpanel" aria-labelledby="dt-tab-versions" tabIndex={-1}>
          <div className="dt-versions">
            {versions
              .slice()
              .reverse()
              .map((v) => (
                <div key={v} className={`dt-version ${v === t.latest ? "is-latest" : ""}`}>
                  <span className="dt-version__v">v{v}</span>
                  {v === t.latest && <span className="dt-version__tag">Latest</span>}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

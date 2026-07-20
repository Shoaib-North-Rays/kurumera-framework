"use client";

import { useState } from "react";
import { Desktop, Tablet, Mobile, Expand } from "@/components/Icons";
import { builderPreviewUrl } from "@/lib/registry";

const WIDTHS = { desktop: "100%", tablet: "768px", mobile: "390px" } as const;
type Device = keyof typeof WIDTHS;

/**
 * PDP preview for a builder template — a live, read-only render of the actual
 * design (via the builder's `/market-preview/<slug>` route), with the same device
 * switcher + full-screen affordance as code themes. No more static placeholder.
 */
export function BuilderPreview({ slug, name }: { slug: string; name: string }) {
  const [device, setDevice] = useState<Device>("desktop");
  const url = builderPreviewUrl(slug);
  const dev: [Device, typeof Desktop, string][] = [["desktop", Desktop, "Desktop"], ["tablet", Tablet, "Tablet"], ["mobile", Mobile, "Mobile"]];
  return (
    <div className="pdp__left">
      <div className="pdp__toolbar">
        <div className="pdp__devices" role="group" aria-label="Preview device">
          {dev.map(([key, Icon, label]) => (
            <button key={key} aria-label={label} aria-pressed={device === key} onClick={() => setDevice(key)}><Icon /></button>
          ))}
        </div>
        <a className="btn btn--secondary pdp__open" href={url} target="_blank" rel="noreferrer"><Expand /> Full screen</a>
      </div>
      <div className="pdp__stage">
        <div className="pdp__device" style={{ width: WIDTHS[device] }}>
          <iframe src={url} title={`${name} live preview`} loading="lazy" />
        </div>
      </div>
    </div>
  );
}

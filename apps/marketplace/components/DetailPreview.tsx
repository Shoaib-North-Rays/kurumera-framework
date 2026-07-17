"use client";

import { useState } from "react";
import { Desktop, Tablet, Mobile, Expand } from "@/components/Icons";
import { previewUrl } from "@/lib/registry";

const WIDTHS = { desktop: "100%", tablet: "768px", mobile: "390px" } as const;
type Device = keyof typeof WIDTHS;

export function DetailPreview({ slug, name }: { slug: string; name: string }) {
  const [device, setDevice] = useState<Device>("desktop");
  const url = previewUrl(slug);
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

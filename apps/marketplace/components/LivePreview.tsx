"use client";

import { useEffect, useRef } from "react";
import { previewUrl } from "@/lib/registry";

/**
 * A scaled, non-interactive live render of the real theme (via the existing
 * ?market=<slug> preview). Rendered at a desktop width and scaled to fit its
 * frame — a "screenshot" of the actual site. Lazy so off-screen cards don't
 * wake theme containers. (Static screenshots replace this in the fast-follow.)
 */
export function LivePreview({ slug, name = "", base = 1280 }: { slug: string; name?: string; base?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const iframe = el.querySelector("iframe") as HTMLIFrameElement | null;
    if (!iframe) return;
    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      const scale = w / base;
      iframe.style.width = base + "px";
      iframe.style.height = Math.ceil(h / scale) + "px";
      iframe.style.transform = `scale(${scale})`;
    };
    fit();
    const onLoad = () => iframe.classList.add("ready");
    iframe.addEventListener("load", onLoad);
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => { ro.disconnect(); iframe.removeEventListener("load", onLoad); };
  }, [base]);

  return (
    <div className="frame" ref={ref}>
      <span className="frame__ph" aria-hidden="true">{(name || slug).slice(0, 1).toUpperCase()}</span>
      <iframe src={previewUrl(slug)} title={`${name || slug} preview`} loading="lazy" scrolling="no" tabIndex={-1} />
    </div>
  );
}

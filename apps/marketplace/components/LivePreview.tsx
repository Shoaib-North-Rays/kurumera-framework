"use client";

import { useEffect, useRef, useState } from "react";
import { previewUrl } from "@/lib/registry";

/**
 * A scaled, non-interactive live render of the real theme (via the existing
 * ?market=<slug> preview), used only when a theme has no static screenshot yet.
 * The iframe is mounted lazily — only when the card comes within 300px of the
 * viewport — so a long grid never wakes dozens of theme containers at once.
 */
export function LivePreview({ slug, name = "", base = 1280 }: { slug: string; name?: string; base?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Mount the iframe only once the frame nears the viewport.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); }
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Scale the (desktop-width) iframe to fit its frame, once mounted.
  useEffect(() => {
    if (!visible) return;
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
  }, [base, visible]);

  return (
    <div className="frame" ref={ref}>
      <span className="frame__ph" aria-hidden="true">{(name || slug).slice(0, 1).toUpperCase()}</span>
      {visible && <iframe src={previewUrl(slug)} title={`${name || slug} preview`} loading="lazy" scrolling="no" tabIndex={-1} />}
    </div>
  );
}

"use client";

import { PreviewStage } from "@/components/PreviewStage";
import { previewUrl } from "@/lib/registry";

/**
 * PDP preview for a CODE theme — the live site, served from its own container.
 *
 * All behaviour lives in PreviewStage, which both preview types share. This was
 * byte-identical to BuilderPreview apart from the URL, so a fix made here (the
 * cover poster that hides the container's cold start) silently would not have
 * reached the other one.
 */
export function DetailPreview({ slug, name, cover }: { slug: string; name: string; cover?: string }) {
  return <PreviewStage url={previewUrl(slug)} name={name} cover={cover} />;
}

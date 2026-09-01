"use client";

import { PreviewStage } from "@/components/PreviewStage";
import { builderPreviewUrl } from "@/lib/registry";

/**
 * PDP preview for a BUILDER design — a live, read-only render of the actual
 * design via the builder's `/market-preview/<slug>` route.
 *
 * Shares PreviewStage with code themes. These previews are quicker (measured
 * 0.6–1.5s cold, ~0.2s warm) but the same poster applies: a second of empty
 * white on the page where someone decides to buy is still a second too many.
 */
export function BuilderPreview({ slug, name, cover }: { slug: string; name: string; cover?: string }) {
  return <PreviewStage url={builderPreviewUrl(slug)} name={name} cover={cover} />;
}

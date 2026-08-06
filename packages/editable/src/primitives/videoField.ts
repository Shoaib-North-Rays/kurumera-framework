/**
 * Pure helpers shared by EditableVideo (Server Component, imports
 * `resolveEditableContent` → `next/headers`) and EditableVideoClient (a
 * "use client" leaf). Deliberately kept in their OWN module with zero
 * server-only imports: a "use client" file importing even one VALUE
 * (non-type-only) export from EditableVideo.tsx would pull that whole
 * module — including its `next/headers` import — into the client bundle
 * graph and fail the build. `import type` alone gets erased at compile
 * time and would have been safe, but `toEmbedSrc` is a real function, so
 * this split is required, not just tidy.
 */
export type VideoProvider = "file" | "youtube" | "vimeo";

export interface EditableVideoValue {
  src: string;
  poster?: string;
  provider: VideoProvider;
}

function extractYouTubeId(src: string): string | null {
  const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{6,})/.exec(src);
  return m ? m[1] : null;
}

function extractVimeoId(src: string): string | null {
  const m = /vimeo\.com\/(?:video\/)?(\d+)/.exec(src);
  return m ? m[1] : null;
}

/** Resolves a merchant-pasted URL (or bare id) to an embeddable iframe src. */
export function toEmbedSrc(provider: "youtube" | "vimeo", src: string): string {
  if (provider === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${extractYouTubeId(src) ?? src}`;
  }
  return `https://player.vimeo.com/video/${extractVimeoId(src) ?? src}`;
}

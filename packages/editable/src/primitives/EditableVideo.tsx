import { resolveEditableContent } from "../server/resolve.js";
import { EditableVideoClient } from "./EditableVideoClient.js";
import { toEmbedSrc, type EditableVideoValue, type VideoProvider } from "./videoField.js";

export type { VideoProvider, EditableVideoValue } from "./videoField.js";

export interface EditableVideoProps {
  field: string;
  defaultSrc: string;
  defaultPoster?: string;
  defaultProvider?: VideoProvider;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
}

function resolveValue(raw: unknown, defaults: EditableVideoValue): EditableVideoValue {
  if (raw && typeof raw === "object" && "src" in (raw as Record<string, unknown>)) {
    const v = raw as Partial<EditableVideoValue>;
    return {
      src: v.src || defaults.src,
      poster: v.poster ?? defaults.poster,
      provider: v.provider === "youtube" || v.provider === "vimeo" || v.provider === "file" ? v.provider : defaults.provider,
    };
  }
  return defaults;
}

/**
 * Live rendering is a plain native element either way — `<video>` for an
 * uploaded file, a plain `<iframe>` embed for YouTube/Vimeo — so, like
 * EditableImage, a real shopper's page ships zero extra client JS for this
 * field even though the value itself is merchant-editable.
 */
export async function EditableVideo({
  field,
  defaultSrc,
  defaultPoster,
  defaultProvider = "file",
  className,
  autoPlay,
  loop,
  muted,
  controls = true,
}: EditableVideoProps) {
  const { mode, fields } = await resolveEditableContent();
  const value = resolveValue(fields[field]?.value, { src: defaultSrc, poster: defaultPoster, provider: defaultProvider });

  if (mode !== "edit") {
    if (value.provider === "file") {
      return (
        <video
          src={value.src}
          poster={value.poster}
          className={className}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          controls={controls}
          playsInline
        />
      );
    }
    return (
      <iframe
        src={toEmbedSrc(value.provider, value.src)}
        className={className}
        title="Video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <EditableVideoClient
      field={field}
      defaultValue={{ src: defaultSrc, poster: defaultPoster, provider: defaultProvider }}
      className={className}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      controls={controls}
    />
  );
}

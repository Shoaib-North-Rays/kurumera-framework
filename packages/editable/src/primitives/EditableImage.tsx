import { resolveEditableContent } from "../server/resolve.js";
import { EditableImageClient } from "./EditableImageClient.js";

export interface EditableImageValue {
  src: string;
  alt?: string;
}

export interface EditableImageProps {
  field: string;
  defaultSrc: string;
  defaultAlt?: string;
  className?: string;
  width?: number;
  height?: number;
  sizes?: string;
}

function resolveValue(raw: unknown, defaultSrc: string, defaultAlt?: string): EditableImageValue {
  if (raw && typeof raw === "object" && "src" in (raw as Record<string, unknown>)) {
    const v = raw as Partial<EditableImageValue>;
    return { src: v.src || defaultSrc, alt: v.alt ?? defaultAlt ?? "" };
  }
  return { src: defaultSrc, alt: defaultAlt ?? "" };
}

/** base-theme deliberately never uses next/image (server/CDN-agnostic
 * merchant image hosts) — this primitive follows that same convention. */
export async function EditableImage({ field, defaultSrc, defaultAlt, className, width, height, sizes }: EditableImageProps) {
  const { mode, fields } = await resolveEditableContent();
  const { src, alt } = resolveValue(fields[field]?.value, defaultSrc, defaultAlt);

  if (mode !== "edit") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} width={width} height={height} sizes={sizes} />;
  }
  return (
    <EditableImageClient
      field={field}
      defaultSrc={defaultSrc}
      defaultAlt={defaultAlt}
      className={className}
      width={width}
      height={height}
      sizes={sizes}
    />
  );
}

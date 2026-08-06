import type { ReactNode } from "react";
import { resolveEditableContent } from "../server/resolve.js";
import { EditableBackgroundImageClient } from "./EditableBackgroundImageClient.js";

export interface EditableBackgroundImageProps {
  field: string;
  defaultSrc: string;
  as?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Unlike EditableImage, this component IS the container the theme dev
 * would otherwise have written by hand (`<div className="hero"
 * style={{backgroundImage}}>...</div>`) — not an extra wrapper around it.
 * `children` render exactly as given, live or edit; only the background
 * image itself is ever merchant-editable.
 */
export async function EditableBackgroundImage({ field, defaultSrc, as = "div", className, children }: EditableBackgroundImageProps) {
  const { mode, fields } = await resolveEditableContent();
  const src = (fields[field]?.value as string | undefined) || defaultSrc;

  if (mode !== "edit") {
    const As = as as any;
    return (
      <As className={className} style={{ backgroundImage: `url(${src})` }}>
        {children}
      </As>
    );
  }
  return (
    <EditableBackgroundImageClient field={field} defaultSrc={defaultSrc} as={as} className={className}>
      {children}
    </EditableBackgroundImageClient>
  );
}

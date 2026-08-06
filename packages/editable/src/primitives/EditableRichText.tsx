import type { ElementType } from "react";
import { resolveEditableContent } from "../server/resolve.js";
import { EditableRichTextClient } from "./EditableRichTextClient.js";

export interface EditableRichTextProps {
  field: string;
  /** Sanitized HTML — round-trips through the backend's own sanitizer on
   * save; this component never trusts browser-produced HTML as final. */
  defaultValue: string;
  as?: ElementType;
  className?: string;
}

export async function EditableRichText({ field, defaultValue, as: As = "div", className }: EditableRichTextProps) {
  const { mode, fields } = await resolveEditableContent();
  const value = (fields[field]?.value as string | undefined) ?? defaultValue;

  if (mode !== "edit") {
    return <As className={className} dangerouslySetInnerHTML={{ __html: value }} />;
  }
  return <EditableRichTextClient field={field} defaultValue={defaultValue} as={As} className={className} />;
}

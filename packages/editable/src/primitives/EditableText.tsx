import type { ElementType } from "react";
import { resolveEditableContent } from "../server/resolve.js";
import { EditableTextClient } from "./EditableTextClient.js";

export interface EditableTextProps {
  /** Dotted field key, e.g. "home.hero.heading". */
  field: string;
  /** Rendered verbatim until a merchant edits this field — existing stores
   * are unaffected until something is actually edited. */
  defaultValue: string;
  as?: ElementType;
  className?: string;
  maxLength?: number;
}

/**
 * Server Component — no "use client". Outside edit mode this renders a
 * plain tag with zero extra markup and zero client JS: Next's RSC
 * code-splitting means `EditableTextClient`'s bytes are never even
 * requested by a shopper's browser, not merely hidden.
 */
export async function EditableText({ field, defaultValue, as: As = "span", className, maxLength }: EditableTextProps) {
  const { mode, fields } = await resolveEditableContent();
  const value = (fields[field]?.value as string | undefined) ?? defaultValue;

  if (mode !== "edit") {
    return <As className={className}>{value}</As>;
  }
  return (
    <EditableTextClient field={field} defaultValue={defaultValue} as={As} className={className} maxLength={maxLength} />
  );
}

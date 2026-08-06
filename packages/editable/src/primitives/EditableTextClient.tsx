"use client";
import type { ElementType, FocusEvent } from "react";
import { useEditableField } from "../useEditableField.js";
import { editableClassName } from "../chrome.js";

export interface EditableTextClientProps {
  field: string;
  defaultValue: string;
  as: ElementType;
  className?: string;
  maxLength?: number;
}

export function EditableTextClient({ field, defaultValue, as: As, className, maxLength }: EditableTextClientProps) {
  const { value, setValue, status, retry } = useEditableField<string>(field, defaultValue, { type: "text" });

  function handleBlur(e: FocusEvent<HTMLElement>) {
    let next = e.currentTarget.textContent ?? "";
    if (maxLength && next.length > maxLength) next = next.slice(0, maxLength);
    if (next !== value) setValue(next);
  }

  return (
    <As
      className={editableClassName(className, status)}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      data-kurumera-field={field}
      title={status === "error" ? "Couldn't save — click to retry" : undefined}
      onClick={status === "error" ? () => retry() : undefined}
    >
      {value}
    </As>
  );
}

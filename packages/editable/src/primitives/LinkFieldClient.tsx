"use client";
import { useRef, useState, type FocusEvent } from "react";
import { useEditableField } from "../useEditableField.js";
import { editableClassName } from "../chrome.js";

export interface LinkFieldValue {
  label: string;
  href: string;
}

export interface LinkFieldClientProps {
  field: string;
  defaultValue: LinkFieldValue;
  /** "button" | "link" — only affects the saved field's `type` tag; the
   * two primitives share this exact implementation (~90% identical per
   * design), differing only in what className the theme dev passes. */
  fieldType: "button" | "link";
  className?: string;
}

/** Shared engine for EditableButton and EditableLink — both store the same
 * {label, href} shape and edit the same way (label is contentEditable,
 * href via a small popover since contentEditable can't capture a URL). */
export function LinkFieldClient({ field, defaultValue, fieldType, className }: LinkFieldClientProps) {
  const { value, setValue, status, retry } = useEditableField<LinkFieldValue>(field, defaultValue, { type: fieldType });
  const [editingHref, setEditingHref] = useState(false);
  const hrefInputRef = useRef<HTMLInputElement>(null);

  function handleLabelBlur(e: FocusEvent<HTMLAnchorElement>) {
    const next = e.currentTarget.textContent ?? "";
    if (next !== value.label) setValue({ ...value, label: next });
  }

  function commitHref() {
    const next = hrefInputRef.current?.value ?? value.href;
    if (next !== value.href) setValue({ ...value, href: next });
    setEditingHref(false);
  }

  return (
    <span className="kurumera-editable-linkfield" style={{ position: "relative", display: "inline-block" }}>
      <a
        href={value.href}
        className={editableClassName(className, status)}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleLabelBlur}
        onClick={(e) => {
          e.preventDefault(); // never navigate away from the editor
          if (status === "error") retry();
        }}
        data-kurumera-field={field}
        title={status === "error" ? "Couldn't save — click to retry" : undefined}
      >
        {value.label}
      </a>
      <button
        type="button"
        className="kurumera-editable-linkfield__edit-link"
        contentEditable={false}
        onClick={() => setEditingHref((v) => !v)}
      >
        Edit link
      </button>
      {editingHref ? (
        <span className="kurumera-editable-linkfield__popover" contentEditable={false}>
          <input ref={hrefInputRef} type="text" defaultValue={value.href} placeholder="https://…" />
          <button type="button" onClick={commitHref}>
            Save
          </button>
          <button type="button" onClick={() => setEditingHref(false)}>
            Cancel
          </button>
        </span>
      ) : null}
    </span>
  );
}

"use client";
import { useRef, type ElementType, type FocusEvent } from "react";
import { useEditableField } from "../useEditableField.js";
import { editableClassName } from "../chrome.js";

export interface EditableRichTextClientProps {
  field: string;
  defaultValue: string;
  as: ElementType;
  className?: string;
}

const TOOLBAR_COMMANDS: Array<{ command: string; label: string }> = [
  { command: "bold", label: "B" },
  { command: "italic", label: "I" },
  { command: "createLink", label: "Link" },
];

export function EditableRichTextClient({ field, defaultValue, as: As, className }: EditableRichTextClientProps) {
  const { value, setValue, status, retry } = useEditableField<string>(field, defaultValue, { type: "richtext" });
  const ref = useRef<HTMLElement>(null);

  function handleBlur(e: FocusEvent<HTMLElement>) {
    const next = e.currentTarget.innerHTML ?? "";
    if (next !== value) setValue(next);
  }

  function runCommand(command: string) {
    const el = ref.current;
    if (!el) return;
    el.focus();
    if (command === "createLink") {
      const url = window.prompt("Link URL");
      if (!url) return;
      document.execCommand(command, false, url);
    } else {
      document.execCommand(command, false);
    }
    setValue(el.innerHTML ?? "");
  }

  return (
    <div className="kurumera-editable-richtext" style={{ position: "relative" }}>
      <div className="kurumera-editable-richtext__toolbar" contentEditable={false}>
        {TOOLBAR_COMMANDS.map((c) => (
          <button
            key={c.command}
            type="button"
            onMouseDown={(e) => e.preventDefault() /* keep focus/selection in the editable area */}
            onClick={() => runCommand(c.command)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <As
        ref={ref}
        className={editableClassName(className, status)}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        data-kurumera-field={field}
        title={status === "error" ? "Couldn't save — click to retry" : undefined}
        onClick={status === "error" ? () => retry() : undefined}
        dangerouslySetInnerHTML={{ __html: value }}
      />
    </div>
  );
}

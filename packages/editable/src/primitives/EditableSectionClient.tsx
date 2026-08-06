"use client";
import type { ElementType, ReactNode } from "react";
import { useEditableField } from "../useEditableField.js";

export interface EditableSectionClientProps {
  field?: string;
  label: string;
  as: ElementType;
  className?: string;
  visible: boolean;
  children: ReactNode;
}

export function EditableSectionClient({ field, label, as: As, className, visible, children }: EditableSectionClientProps) {
  // Always call the hook (rules-of-hooks) — a fixed placeholder key is fine
  // when `field` is omitted, since setValue() is simply never invoked.
  const { value, setValue } = useEditableField<{ visible: boolean }>(field ?? `__section_no_field__:${label}`, {
    visible,
  });
  const isVisible = field ? value.visible !== false : true;

  return (
    <div className="kurumera-editable-section" data-kurumera-section={field ?? undefined}>
      <div className="kurumera-editable-section__chip" contentEditable={false}>
        <span>{label}</span>
        {field ? (
          <button type="button" onClick={() => setValue({ visible: !isVisible })}>
            {isVisible ? "Hide" : "Show"}
          </button>
        ) : null}
      </div>
      {isVisible ? <As className={className}>{children}</As> : null}
    </div>
  );
}

import type { ElementType, ReactNode } from "react";
import { resolveEditableContent } from "../server/resolve.js";
import { EditableSectionClient } from "./EditableSectionClient.js";

export interface EditableSectionProps {
  /** Optional — omit for a section that's always visible (hover-outline in
   * edit mode only, no hide/show toggle). Backs a `{visible: boolean}` field. */
  field?: string;
  /** Shown in the edit-mode label chip, e.g. "Hero", "Featured Collections". */
  label: string;
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

/**
 * Formalizes the `{hero.show && (<section>...)}` pattern themes already
 * hand-write as a reusable primitive. `children` are the theme dev's own
 * JSX (fixed at build time) — this component only ever toggles whether
 * they render, never what they are; that's the whole safety boundary.
 */
export async function EditableSection({ field, label, as: As = "section", className, children }: EditableSectionProps) {
  const { mode, fields } = await resolveEditableContent();
  const raw = field ? fields[field]?.value : undefined;
  const visible = typeof raw === "object" && raw !== null && "visible" in (raw as Record<string, unknown>)
    ? (raw as { visible?: boolean }).visible !== false
    : true;

  if (mode !== "edit") {
    if (!visible) return null;
    return <As className={className}>{children}</As>;
  }
  return (
    <EditableSectionClient field={field} label={label} as={As} className={className} visible={visible}>
      {children}
    </EditableSectionClient>
  );
}

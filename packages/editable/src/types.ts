/**
 * Kurumera Editable Components — shared types.
 *
 * `off` = every real shopper (no client leaf JS is ever shipped for this
 * mode — see the per-primitive Server Component split). `edit` = the
 * merchant's in-dashboard content editor iframe. `preview` = the same
 * draft VALUES as `edit`, but rendered through the exact same plain
 * (non-interactive) path `off` uses — see resolveEditableContent.
 */
export type EditMode = "off" | "edit" | "preview";

export type FieldStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export interface FieldRecord {
  value: unknown;
  status: FieldStatus;
  error: string | null;
}

/** What the batched content fetch resolves to for one request. */
export interface EditableResolution {
  mode: EditMode;
  tenant: string;
  editToken: string | null;
  apiUrl?: string;
  fields: Record<string, { value: unknown; type?: string }>;
}

/**
 * @kurumera/editable/client — the client-safe engine: the hook, the
 * provider, and their types.
 *
 * Import from HERE — not the bare `.` entry — inside your OWN "use client"
 * component that needs `useEditableField()` or `EditableProvider`. The bare
 * `.` entry re-exports the 9 Server Component primitives, which
 * transitively import `next/headers` (via `resolveEditableContent`); a
 * "use client" file that reaches even ONE of them — regardless of which
 * named export it actually uses — fails the Next.js build ("You're
 * importing a component that needs next/headers"). The package's own
 * primitives already follow this rule internally: their client leaves
 * import the hook via a relative path, never through either public entry.
 */
export { EditableProvider, useEditableContext } from "./context.js";
export type { EditableProviderProps, EditableContextValue } from "./context.js";

export { useEditableField } from "./useEditableField.js";
export type { UseEditableFieldOptions, UseEditableFieldResult } from "./useEditableField.js";

export type { EditMode, FieldStatus, FieldRecord, EditableResolution } from "./types.js";

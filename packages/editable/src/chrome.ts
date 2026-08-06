import type { FieldStatus } from "./types.js";

/** Shared hover-outline + status class names every client leaf applies —
 * centralized so the visual language (and any future fix to it) is one
 * change, not nine. Consuming themes can target `.kurumera-editable` /
 * `.kurumera-editable--<status>` in their own CSS to restyle. */
export function editableClassName(className: string | undefined, status: FieldStatus): string {
  const parts = ["kurumera-editable", `kurumera-editable--${status}`];
  if (className) parts.push(className);
  return parts.join(" ");
}

/**
 * @kurumera/editable/server — headers()-touching helpers, kept out of the
 * main `.` entry so nothing in a "use client" module's dependency graph can
 * accidentally pull in `next/headers`.
 *
 * Themes generally don't need to import this directly — the root layout is
 * the one place that does, to seed `<EditableProvider>` (see the package
 * README / base-theme's app/layout.tsx for the integration snippet); every
 * `Editable*` primitive already calls it internally.
 */
export { resolveEditableContent } from "./server/resolve.js";

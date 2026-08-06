/**
 * @kurumera/editable — inline, draft/publish, no-rebuild content editing for
 * Kurumera code themes.
 *
 *   import { EditableText, EditableImage, EditableRepeater } from "@kurumera/editable";
 *
 *   <EditableText field="home.hero.heading" defaultValue="Welcome" as="h1" />
 *
 * A field is only ever merchant-editable if it's wrapped in one of these
 * components (or `useEditableField()`) — that's the whole safety boundary:
 * nothing here lets a merchant reach arbitrary layout or code, only content
 * a theme developer explicitly marked.
 *
 * Every primitive here is a Server Component, for use in your theme's
 * page/section files. Outside the dashboard's edit mode (i.e. for every
 * real shopper) each renders plain, semantic markup — no wrapper elements,
 * no hydration, no editor behaviour, no network calls.
 *
 * PERF CAVEAT, measured not assumed: the editor leaves' CODE is still
 * DOWNLOADED by shoppers (~5.5 kB gzipped per route, roughly flat no matter
 * how many fields you wrap). It is never executed or hydrated for them, but
 * it is in the route's client bundle. This is a Next.js constraint, not a
 * choice: a Server Component statically imports its client leaf, and
 * "a Server Component dynamically importing a Client Component" is
 * explicitly unsupported for code splitting (see Next's lazy-loading guide).
 * Eliminating it needs the editor to become one lazily-mounted overlay that
 * attaches to `data-kurumera-field` markers, rather than a client leaf per
 * primitive — a planned change, not yet done. Budget accordingly on
 * latency-critical routes.
 *
 * Need `useEditableField()` or `EditableProvider` inside your OWN "use
 * client" component? Import those from `@kurumera/editable/client`
 * instead — NOT from here (see that entry's docstring for why). The root
 * layout that mounts `<EditableProvider>` uses that subpath too.
 */
export { EditableText } from "./primitives/EditableText.js";
export type { EditableTextProps } from "./primitives/EditableText.js";

export { EditableRichText } from "./primitives/EditableRichText.js";
export type { EditableRichTextProps } from "./primitives/EditableRichText.js";

export { EditableImage } from "./primitives/EditableImage.js";
export type { EditableImageProps, EditableImageValue } from "./primitives/EditableImage.js";

export { EditableSection } from "./primitives/EditableSection.js";
export type { EditableSectionProps } from "./primitives/EditableSection.js";

export { EditableRepeater } from "./primitives/EditableRepeater.js";
export type { EditableRepeaterProps, RepeaterItem } from "./primitives/EditableRepeater.js";

export { EditableButton } from "./primitives/EditableButton.js";
export type { EditableButtonProps } from "./primitives/EditableButton.js";

export { EditableLink } from "./primitives/EditableLink.js";
export type { EditableLinkProps } from "./primitives/EditableLink.js";

export type { LinkFieldValue } from "./primitives/LinkFieldClient.js";

export { EditableVideo } from "./primitives/EditableVideo.js";
export type { EditableVideoProps } from "./primitives/EditableVideo.js";
// `toEmbedSrc` (a real function) is deliberately NOT re-exported here — an
// otherwise-pure helper still poisons this entry for client-file imports if
// it's a VALUE export sitting alongside the primitives (see this module's
// docstring). It's an EditableVideo implementation detail; theme devs don't
// need to compute embed URLs themselves.
export type { EditableVideoValue, VideoProvider } from "./primitives/videoField.js";

export { EditableBackgroundImage } from "./primitives/EditableBackgroundImage.js";
export type { EditableBackgroundImageProps } from "./primitives/EditableBackgroundImage.js";

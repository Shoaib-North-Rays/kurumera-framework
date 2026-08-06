"use client";
import { CHROME_CSS } from "./chrome-css.js";

/**
 * The editor chrome stylesheet, isolated in its own module with a DEFAULT
 * export so <EditableProvider> can pull it in via `next/dynamic`.
 *
 * That indirection is load-bearing, not ceremony: importing CHROME_CSS
 * directly into the provider put the whole stylesheet string in the shared
 * client bundle, so every shopper downloaded ~3 kB of editor CSS they can
 * never use. `next/dynamic` inside a Client Component IS code-split (unlike
 * a Server Component dynamically importing a Client Component, which Next
 * explicitly does not split) — so this chunk is fetched only when a merchant
 * actually opens edit mode.
 */
export default function ChromeStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CHROME_CSS }} />;
}

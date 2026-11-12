# @kurumera/editable — changelog

## 0.5.1 — 2026-11-12

`@kurumera/storefront` is now accepted from 0.9.0 up to (not including) 1.0.0,
was `^0.9.0`. For a 0.x package `^0.9.0` stops at 0.9.x, so a theme on
storefront 0.10 or 0.11 got a second, older copy of the SDK nested under this
package. Nothing here needs more than 0.9 (forwardHeaders).

## 0.5.0 — 2026-10-16

`resolveEditableContent()` now forwards the visitor's `x-forwarded-for` and
`cf-connecting-ip`, as received, on its platform call — the same change as
`@kurumera/storefront` 0.9.0's `forwardHeaders`.

It runs from the root layout on every page, and it never throws by design, so a
call the platform throttled did not fail the page: it quietly rendered without
the merchant's edited content. Without the visitor's address every page view on
a server looked like one visitor, and a single crawler was enough to cause that.

**Dependency change:** `@kurumera/storefront` is now `^0.9.0`, was `^0.3.0`. The
old range made every theme install a separate nested 0.3.x copy of the SDK just
for this package; with it, the forwarding above would have been silently
ignored. Update both packages together.

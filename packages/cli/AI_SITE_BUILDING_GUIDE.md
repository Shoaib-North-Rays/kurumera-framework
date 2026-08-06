# Building a Kurumera store with the CLI (full-control / code path)

This is the guide for the **second** way to build a Kurumera store: a real
Next.js codebase, scaffolded and deployed with the `kurumera` CLI — full
control over markup, components, and logic, as opposed to the visual
drag-and-drop builder (JSON page documents, edited through MCP tools like
`generate_site`/`apply_page_edits`).

**Use this path when the merchant wants:** custom layouts or interactions the
builder's component set can't express, a developer/agent-owned codebase they
can extend indefinitely, or to build a theme to sell on the Kurumera
marketplace. **Use the visual builder instead when:** the merchant wants to
self-edit pages by hand later with no code, or just wants something live fast
from a small set of proven sections.

If you're an AI agent and it's not obvious which the user wants, ask them —
in one sentence: *"Do you want a drag-and-drop site you (or the merchant) can
keep editing visually, or a real codebase with full control that a developer
maintains?"* Don't guess silently; the two paths produce different, largely
non-interchangeable artifacts (`StoreTheme.mode` is `builder` or `code`,
all-or-nothing per store).

Auth is a separate concern with its own doc — **read `AUTHENTICATION.md`
first** if the agent isn't already signed in. Everything below assumes
`kurumera stores list` already succeeds.

## The end-to-end workflow

```bash
kurumera theme init my-store        # scaffold from the base theme
cd my-store
npm install
kurumera theme dev --store <slug>   # run against the store's REAL live data, http://localhost:3000
# … edit the code …
kurumera theme check                # validate before pushing — fix any ✗ errors
kurumera theme push                 # upload; the platform builds it; blocks until built or ~10min timeout
kurumera theme preview --store <slug>   # optional — opens the built, unpublished preview
kurumera theme publish --store <slug>   # make it the store's LIVE theme
```

Each step in order, in more detail:

### 1. `kurumera theme init <name>`

Copies the base theme template into `./<name>` and renames `package.json`.
Prints the exact next steps (`cd`, `npm install`, `theme dev`) — no other
setup is needed. Run this once per project, not per session.

### 2. `kurumera theme dev --store <slug>`

Runs `next dev` against the **real, live data** of an existing store (its
actual products, collections, branding) — not a mock. Auto-installs
`node_modules` on first run if missing. Sets `KURUMERA_TENANT=<slug>` (or
`KURUMERA_STOREFRONT_TOKEN` if `--token` is passed) and `KURUMERA_API_URL` on
the child process automatically — you don't need to hand-write a `.env.local`
for this step. Serves at `http://localhost:3000`.

If `--store` is omitted, it falls back to the default store from
`kurumera login`. If the agent has shell access but no browser, it still
can't *see* the rendered page — read the component/section source instead of
trying to visually inspect `localhost:3000`, or ask the human to look.

**Auto-save while you edit.** `theme dev` also checkpoints the working
directory in the background every few minutes (an inert, disaster-recovery-
only snapshot — never a build, never a version, never anything that could go
live). This exists specifically for you, the agent: if your workspace/sandbox
is destroyed mid-session **before you've ever run a successful `theme push`**,
the edits would otherwise be gone with zero recovery — `theme push`'s own
permanent source retention only kicks in *after* a push succeeds at least
once. If that happens, recover with:
```bash
kurumera theme checkpoint restore --store <slug>
```
(`kurumera theme checkpoint status --store <slug>` checks whether one exists
and how recent it is, without downloading it.) Still push for real as soon as
a change is worth keeping — a checkpoint is a safety net, not a substitute
for `theme push`'s permanent, immutable retention.

### 3. Editing the theme

The scaffolded project (from `base-theme/`) has this shape:

```
theme.config.ts        theme manifest — name/version/routes/settings (see below)
middleware.ts           resolves the store from the request host/?store=
app/
  layout.tsx             root layout — exports metadata (SEO), renders Header/Footer
  page.tsx                home
  products/[handle]/     PDP — required route
  collections/[handle]/  PLP — required route
  cart/                   required route
  search/                 required route
  pages/[handle]/         CMS page template — required route
  not-found.tsx           custom 404 (optional but recommended)
components/              Header, Footer, ProductCard, AddToCart, Price, CartCount,
                          AnnouncementBar, MobileMenu, Newsletter, Icon
sections/                FeaturedCollections, FeaturedProducts, ValueProps
lib/
  kurumera.ts             getStore() — builds the per-request SDK client (below)
  settings.ts             ThemeSettings type + defaults — the merchant-editable surface
  demo-fetch.ts            mock data client, active only when KURUMERA_DEMO=1
  cart-client.ts          client-side cart hook/state
```

**The required routes are load-bearing** — `theme check` fails the push if
any of `app/page.tsx`, `app/products/[handle]/page.tsx`,
`app/collections/[handle]/page.tsx`, `app/cart/page.tsx`,
`app/search/page.tsx`, `app/pages/[handle]/page.tsx` are missing. Renaming or
removing them (rather than editing their contents) breaks the theme.

**Reading store data — always through `lib/kurumera.ts`'s `getStore()`**,
never a hand-rolled `fetch`:

```ts
import { getStore } from "@/lib/kurumera";

const kurumera = await getStore();
const products = await kurumera.products.list({ limit: 12 });
const product  = await kurumera.products.getByHandle(handle);
const bestSellers = await kurumera.products.bestSellers();
const deals    = await kurumera.products.deals();
const collections = await kurumera.collections.list();
const collection  = await kurumera.collections.getByHandle(handle);
const bySlot   = await kurumera.collections.getBySlot("featured");
const results  = await kurumera.search.query(q);           // → { query, limit, products, collections }
const page     = await kurumera.pages.getByHandle(handle);   // CMS page
const menus    = await kurumera.navigation.all();             // → Record<handle, Menu>
const config   = await kurumera.config.get();                 // branding, contact, SEO defaults
```

Cart is a separate client-side surface (`kurumera.cart.create/get/addLine/
updateLine/...` — POST/GET/PATCH/DELETE on `/cart/<token>/...`); see
`lib/cart-client.ts` for the existing hook pattern to extend rather than
re-plumbing it.

**Merchant-editable presentation** lives in `lib/settings.ts`'s
`ThemeSettings` (colors, fonts, logo, announcement bar, hero copy/CTAs, value
props, featured-section titles) — populated from `ShopSettings.theme` via
`getStoreConfig()`, always filled with defaults so an uncustomized store
renders exactly like the template. Read settings through this module, don't
duplicate the merge/defaulting logic.

**Arbitrary editable content — `@kurumera/editable`.** `ThemeSettings` above
covers one FIXED, built-in set of fields. For anything else — a testimonial
list, a CMS-style block of copy on a custom page, an about-page hero — wrap
it in a component from `@kurumera/editable` instead of hand-writing it:

```tsx
import { EditableText, EditableImage, EditableRepeater } from "@kurumera/editable";

<EditableText field="about.heading" defaultValue="Our story" as="h1" />
<EditableImage field="about.heroImage" defaultSrc="/img/about.jpg" defaultAlt="Our team" />

<EditableRepeater
  field="about.testimonials"
  defaultItems={[{ quote: "Great products.", author: "A. Merchant" }]}
  itemDefaults={{ quote: "New testimonial", author: "Customer name" }}
  itemClassName="testimonial-card"
>
  {(item) => (
    <>
      <EditableText field={item.fieldFor("quote")} defaultValue={item.data.quote} />
      <EditableText field={item.fieldFor("author")} defaultValue={item.data.author} as="p" />
    </>
  )}
</EditableRepeater>
```

`field` is any dotted key you choose (`"about.heading"`, not a fixed schema —
`theme.config.ts` doesn't need to declare it). A shopper always gets plain,
semantic markup — no wrapper elements, no hydration, no editor behaviour
(though the editor code itself is still in the route bundle, ~5.5 kB gzipped
and roughly flat however many fields you wrap — see the perf note at the end
of this section); a merchant sees hover/click editing UI ONLY when
viewing the store through the dashboard's "Edit content" screen (a real
draft, autosaved, never live until the merchant clicks Publish there — no
rebuild). This is a **separate system from `ThemeSettings`** — don't wrap a
field that's already driven by `getSettings()` (e.g. don't put
`EditableText` around `hero.title`), or the two will fight over which value
wins. Use `ThemeSettings` for the built-in presentation fields it already
covers; use `@kurumera/editable` for everything else.

Full primitive list: `EditableText`, `EditableRichText`, `EditableImage`,
`EditableBackgroundImage`, `EditableButton`, `EditableLink`, `EditableVideo`,
`EditableSection` (hide/show a whole block), `EditableRepeater`, and
`useEditableField()` (the hook the primitives are built on, for a field
shape none of them cover).

**Importing `useEditableField()`/`EditableProvider` yourself — use
`@kurumera/editable/client`, not the bare package.** The 9 primitives above
(imported from plain `"@kurumera/editable"`) are Server Components that
internally read request headers — fine everywhere you'd normally use them
(page/section files), but if your OWN `"use client"` component imports
`useEditableField` from the bare `"@kurumera/editable"` entry, the build
fails with *"You're importing a component that needs next/headers"* — even
though the hook itself doesn't touch headers, because it'd be reached
through the same module graph as the primitives that do. Import it from the
dedicated client-safe entry instead:
```tsx
"use client";
import { useEditableField } from "@kurumera/editable/client";
```
A plain `import type { ... } from "@kurumera/editable"` (types only, no
runtime import) is always safe from either entry.

A few notes on the less obvious primitives:

```tsx
import { EditableBackgroundImage, EditableButton, EditableVideo } from "@kurumera/editable";

{/* IS the container — not a wrapper around one you'd otherwise write */}
<EditableBackgroundImage field="home.hero.bg" defaultSrc="/img/hero.jpg" className="hero">
  <h1>Welcome</h1>
</EditableBackgroundImage>

<EditableButton field="home.hero.cta" defaultLabel="Shop now" defaultHref="/search" className="btn btn--primary" />

{/* provider is auto-detected from a pasted YouTube/Vimeo URL, or "file" for an upload */}
<EditableVideo field="home.hero.video" defaultSrc="/video/hero.mp4" muted autoPlay loop />
```

`EditableButton` and `EditableLink` share the exact same `{label, href}`
field shape and editing UI — reach for `EditableButton` for a styled CTA,
`EditableLink` for an inline text link; they're kept as separate exports
because they're expected to diverge (e.g. a link-only "open in new tab"
toggle) even though today they're ~identical. `EditableVideo` renders a
plain `<video>` or a plain iframe embed in the live path — native elements,
no player library.

**Worked example in the scaffold:** `sections/Testimonials.tsx` (shipped with
every `theme init`) uses `EditableSection` + `EditableRepeater` +
`EditableText` together on a real, rendered section. Read it and copy the
shape rather than inventing your own.

**Perf note (measured, not theoretical):** wrapping fields puts the editor
leaves' code in that route's client bundle — about **5.5 kB gzipped**, and
roughly flat whether you wrap five fields or fifty. Shoppers download it but
never execute it (no hydration, no listeners, no fetches). This is a Next.js
constraint: a Server Component statically imports its client leaf, and
dynamically importing a Client Component *from* a Server Component is
explicitly unsupported for code splitting. So: wrap what a merchant will
realistically want to edit, and don't blanket-wrap a latency-critical
landing route "just in case."

**Local dev vs. production data:** `getStore()` resolves the tenant from the
request's subdomain (`<slug>.kurumera.com`) in production, or from
`KURUMERA_TENANT`/`KURUMERA_STOREFRONT_TOKEN` env vars for local dev (which
`theme dev` sets for you automatically — see above). If you ever run `next
dev` directly instead of `kurumera theme dev`, or run a **pulled/downloaded**
theme (`theme pull`, or a dashboard download), you must set
`KURUMERA_TENANT=<slug>` in `.env.local` yourself, or you'll hit: *"No store
resolved for this request."* — this is expected, not a bug.

### 4. `kurumera theme check`

Run this before every push — it's the exact ruleset the server re-validates,
so failing locally means the push will be rejected anyway. Categories:
**contract** (the six required routes above, a custom 404), **config**
(`theme.config.ts` present with `name`/`version`/`framework: "nextjs"`),
**dependencies** (`@kurumera/storefront` must be present; server/native
packages — `express`, `pg`, `stripe`, `puppeteer`, `bcrypt`,
`jsonwebtoken`, etc. — are forbidden, themes are client-safe only),
**security** (no `app/api/` routes, no Node built-ins like `fs`/`child_process`/
`net`/`http` imported anywhere, no `"use server"`, no `eval`/`new Function`),
**commerce** (the PDP should show a price and an add-to-cart control),
**seo** (root layout should export `metadata`), **env** (only
`process.env.KURUMERA_*` and `NODE_ENV` are available at runtime — anything
else you read will be `undefined` in production; the check just warns, it
doesn't block).

Only `✗` errors block a push; `⚠` warnings are advisory. Fix errors, then
re-run until it prints "✓ theme check passed."

### 5. `kurumera theme push`

Tars the current directory (excluding `node_modules`/`.next`/`.git`/`dist`),
uploads it, and **blocks** (with a spinner) until the platform's build
finishes or ~10 minutes elapse — you'll get a clear "✓ Built" or
"✗ Build failed" before the command returns, so you always know the outcome
before doing anything else. On success it prints the exact next command
(`kurumera theme publish …`). If it times out mid-build it's still running
server-side — `kurumera theme preview` picks up the result.

### 6. `kurumera theme preview --store <slug>` (optional)

Opens the just-built, **unpublished** version rendered against the real
store — useful to sanity-check before going live. Prints the URL either way
(it also tries to open a real browser, which won't do anything useful in a
headless agent sandbox — just relay the printed URL to the human).

### 7. `kurumera theme publish --store <slug>`

Makes the just-pushed build the store's live theme. `--off` reverts the
store to the visual builder instead (an intentional escape hatch — this is
the one operation that crosses back to the other mode).

## After the store is live

- `kurumera theme rollback --store <slug> [--version <id>]` — restore the
  previous live version, or an exact retained one.
- `kurumera theme activate --store <slug> --version <id>` — make an exact
  version live (works even for a version whose build was pruned from hot
  storage — it rebuilds from the permanently retained source first).
- `kurumera theme versions --store <slug>` — every retained version, with the
  ids the two commands above expect.
- `kurumera theme pull --store <slug> --version <id> [--out <dir>]` —
  download an exact version's original source to a new folder. Auto-writes
  `.env.local` with `KURUMERA_TENANT=<slug>` so `npm install && npm run dev`
  works immediately. Use this once at least one push succeeded — it's a real,
  permanent, immutable version, unlike a checkpoint.
- `kurumera theme checkpoint restore --store <slug> [--out <dir>]` /
  `kurumera theme checkpoint status --store <slug>` — recover the most recent
  auto-saved in-progress snapshot from `theme dev` (see step 2). Only useful
  for edits that never made it into a real push — once pushed, use
  `theme pull` instead.
- `kurumera theme logs --store <slug>` — latest build log, for debugging a
  failed push.

## Selling the theme (optional)

`kurumera marketplace publish --store <slug>` lists the just-built theme in
the Kurumera marketplace for other merchants to install
(`marketplace install <theme>[@version] --store <slug>`). `marketplace list`/
`info`/`mine`/`update`/`unpublish` manage listings; needs the
`marketplace:publish` scope (see `AUTHENTICATION.md`'s scopes table).

## Common mistakes to avoid

- Don't hand-roll `fetch()` calls to the platform API — always go through
  `getStore()`'s SDK client, or `theme check` will flag the raw import and
  you'll lose the auth/tenant-resolution handling it does for you.
- Don't add a database, server framework, or secrets-requiring package —
  `theme check`'s forbidden-dependency list exists because themes run as
  client-safe, sandboxed code; there is no server runtime to put them in.
- Don't skip `theme check` "to save time" — a failing push wastes a full
  build cycle finding out the same thing the local check would have told you
  in seconds.
- Don't publish before previewing at least once if the change is
  non-trivial — `theme preview` costs nothing and catches rendering issues
  before a real customer sees them.
- Don't treat auto-save checkpoints as a substitute for pushing — they're a
  disaster-recovery net for a workspace that dies mid-session, not permanent
  storage. Push real progress as soon as it's worth keeping; a checkpoint can
  be overwritten by the next one and isn't versioned.
- Don't hand-write your own hover/click editing UI for merchant-editable
  copy — wrap the field in `@kurumera/editable`'s `EditableText`/
  `EditableImage`/etc. instead. Writing plain JSX around it (no wrapper) means
  the merchant can never edit it from the dashboard at all — that's the
  system's actual safety boundary, not an oversight to work around.

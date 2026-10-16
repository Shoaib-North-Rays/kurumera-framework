# Theme patches: forward the visitor on server-side API calls

Two merchant themes need the same change as `base-theme/lib/kurumera.ts`. They
are kept here as patches because their source does not live in this repo and
could not be pushed from where the change was made.

| file | for | applies to |
|---|---|---|
| `the-plants-mall-forward-visitor.patch` | `WaqarGitNorthrays/the-plants-mall` | live version `v1792144718489` |
| `amsal-foods-forward-visitor.patch` | Amsal Foods (no repo found) | live version `v1792126587182` |

Both were checked with `git apply --check` against the exact source those live
versions were built from.

## What each patch does

- `lib/kurumera.ts` — `getStore()` passes `forwardHeaders` with the request's
  `x-forwarded-for` and `cf-connecting-ip`, exactly as received, and exports a
  `visitorHeaders()` helper for a theme's own server-side `fetch()`.
- `lib/root-files.ts` (the-plants-mall only) — `platformFile()`, which serves
  `/sitemap.xml` and `/llms.txt`, forwards the same two headers. Crawlers are
  what read these two files.
- `package.json` — `@kurumera/storefront` → `^0.9.0` (the version with
  `forwardHeaders`) and `@kurumera/editable` → `^0.5.0`.

The `editable` bump is not optional. Older `@kurumera/editable` depends on
`@kurumera/storefront ^0.3.0`, so a theme gives it a separate, nested 0.3.x copy
of the SDK that has never heard of `forwardHeaders` and silently ignores it. Its
`resolveEditableContent()` runs from the root layout on every page.

Not changed, on purpose: `components/TradeBriefBuilder.tsx` and
`lib/fresh-request-client.ts` run in the browser (the latter is imported only by
the client component `FreshCheckoutForm`), and the browser's own requests already
carry the visitor's address.

## Applying one (needs the new packages on npm first)

```bash
cd <theme repo>
git apply /path/to/<store>-forward-visitor.patch
npm install                 # updates package-lock.json to storefront 0.9.0 / editable 0.5.0
npx tsc --noEmit
kurumera theme check        # should show no "visitor-not-forwarded" warning
git commit -am "forward the visitor on server-side API calls"
kurumera theme push
kurumera theme publish --store <slug>    # needs Sajid's yes
```

Never `kurumera theme pull` into the git working folder: it replaces the whole
folder, `.git` included.

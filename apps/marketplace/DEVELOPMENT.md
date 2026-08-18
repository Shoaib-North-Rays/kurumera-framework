# Developing the marketplace

## Run it on port 3002. Not 4400.

`npm run dev` serves on **3002**, and that number is load-bearing rather than
arbitrary.

Almost every visual on this site is a **live cross-origin iframe** of the theme
it is advertising — there are no cover images (see below). Those iframes are
served by `themekit.kurumera.com`, which sends:

```
frame-ancestors 'self' https://kurumera.com https://*.kurumera.com
                http://localhost:3000 http://localhost:3001 http://localhost:3002
```

The dev server used to run on **4400**, which is not in that list. So every
code-theme preview was silently CSP-blocked in local development, and anyone
opening the app to work on it saw a wall of empty boxes — while production,
served from an allowed origin, looked fine. Zero of the current templates are
builder-type (whose CSP does allow 4400), so nothing masked it.

`npm start` still uses 4400 because production is deployed on that port and is
allowed by origin, not by the localhost entries.

If you must run on another port, add it to `frame-ancestors` on the themekit
service first, or you are debugging a blank page for no reason.

## Known content gaps

Worth knowing before designing anything image-led — measured against the live
catalogue, not assumed:

- **All templates have `coverImage: ""`** and the cover endpoint 404s. The
  Playwright capture pipeline has never produced an image. Every thumbnail,
  category tile and hero visual is therefore a live iframe.
- The home page mounts **16 iframes**, several of the same theme. That is the
  dominant performance cost of the page, and it is why any redesign that
  re-mounts the page subtree on navigation (the usual `template.tsx` keyed on
  pathname) is expensive rather than merely animated.
- Several categories have no templates and render placeholder tiles.

Design decisions that depend on large photography should wait on the cover
pipeline, not route around it with stock imagery — the previews ARE the product.

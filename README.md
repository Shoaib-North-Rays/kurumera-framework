# Kurumera Framework

A Shopify-like framework for building **Next.js code themes** for Kurumera stores:
clone → dev → push → preview → publish, through the `kurumera` CLI.

See the platform plan: `theplantsmall-backend/docs/theme-framework/P0-SPEC.md`.

## Packages

| Package | What it is |
|---|---|
| `@kurumera/storefront` | Typed Storefront SDK over the platform's public APIs (products, collections, cart, checkout, search, pages, navigation, config). |
| `@kurumera/theme` | Runtime helpers: `defineTheme`, SEO/metadata, image + route helpers, safe env access. |
| `@kurumera/cli` | `kurumera login / stores list / theme init / dev / check / push / preview / publish`. |
| `base-theme/` | The official starter Next.js theme, built on the SDK. |

## Status

**P1 (in progress).** SDK first, then CLI `login/init/dev`, then the base theme.
The backend read-only **storefront token** (`ksf_…`) that the SDK authenticates
with ships on the backend `feature/theme-framework` branch.

## Quick start (target DX)

```bash
npm install -g @kurumera/cli
kurumera login
kurumera theme init my-theme && cd my-theme
kurumera theme dev --store my-demo-store
```

# @kurumera/storefront — changelog

## 0.9.0 — 2026-10-16

### Server-rendered pages can say which visitor they are for

New client option, **server-side only**:

```ts
createKurumeraClient({
  tenant,
  forwardHeaders: {
    "x-forwarded-for": h.get("x-forwarded-for"),
    "cf-connecting-ip": h.get("cf-connecting-ip"),
  },
});
```

A page rendered on the server calls the platform from the server. Until now none
of those calls said whose page view caused them, so the platform saw every one
as coming from the single machine that renders the storefront — and every store
on that machine shared one rate limit (300 storefront requests a minute). On
2026-10-16 one crawler reading one sitemap made 53 product and collection pages
answer 500 on a live store, and could have done the same to every other store on
the same machine.

With `forwardHeaders` set, each call carries the visitor's address headers and
the platform limits each visitor separately. The limit itself is unchanged.

Pass the headers **exactly as the page request received them**. The platform
walks `x-forwarded-for` from the right, past the hops it operates, to find where
the request entered; that is what stops a visitor choosing their own limit by
sending a forged header. A theme that parsed, picked or rebuilt the chain would
undo that. The SDK only drops a value that could not be a header at all (a
control character, which would make `fetch` throw) or that is over 1 KB.

Never set it in the browser: a browser cannot send these headers, and its own
requests already carry the visitor's address. Leaving it unset changes nothing.

### A brief rate limit on a read no longer fails the page

A `GET` answered `429` with a `Retry-After` of 2 seconds or less is retried once
after that wait. Writes are never retried, and nothing is retried twice, so a
sustained limit still surfaces as an error. `throttleRetryMaxWait` changes the
threshold; `0` turns it off.

`KurumeraError` gains `retryAfter` (seconds, from the platform's `Retry-After`,
or `null`) and `throttled` (true on 429), so a theme can tell a temporary limit
from a real failure.

### Compatibility

Additive. Existing callers send exactly the same requests as before; the only
behaviour change for them is the single short retry on a throttled read.

## 0.8.0

`startSessionTracking`, `trackSearchClick`, `trackOutOfStockView`, and the
`SESSION_START`, `SESSION_END`, `SEARCH_CLICK` and `OUT_OF_STOCK_VIEW` events.

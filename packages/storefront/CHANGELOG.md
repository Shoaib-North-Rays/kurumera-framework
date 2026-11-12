# @kurumera/storefront — changelog

## 0.11.0 — unreleased

### Product videos

A product can now carry up to two videos, as YouTube or Vimeo links (nothing
is hosted by the platform). `getProduct` returns two new fields:

- `videos`: the product's videos (`ProductVideo`).
- `media`: the whole gallery, pictures and videos, in the merchant's order
  (`ProductMedia[]`, each item `type: "image"` or `type: "video"`).

`images` is unchanged, so a theme that ignores videos keeps working. Both new
fields are optional: an older platform does not send them, so fall back to
`images`. Play a video by putting its `embed_url` in an iframe; it is the
provider's own player (YouTube no-cookie, Vimeo do-not-track). Load it when the
shopper presses play, not with the page.

A video can also be **uploaded** to the store's media library
(`provider: "upload"`, on when the platform's media is on cloud storage). Play
its `src` (type `mime_type`) in a plain `<video>`; its `embed_url` is empty and
its `thumbnail` is the cover the merchant chose, or empty.

## 0.10.0 — 2026-11-11

### Subscription plans: list them, start a checkout (KME-551)

A store can sell monthly and yearly plans on its own Stripe account. A code
theme now shows them and sends the shopper to checkout, holding no key: the
platform makes the Stripe checkout with the store's own key and answers only
its address.

```ts
const { accepting_new, message, results } = await kurumera.subscriptions.plans();

const answer = await kurumera.subscriptions.checkout({
  plan: "studio",            // the plan's handle
  period: "year",            // "month" | "year"
  email,
  successUrl: "https://app.example.com/welcome",   // on the store's own site, https
  cancelUrl: "https://example.com/pricing",
});
if (answer.ok) {
  if (answer.notice) await confirm(answer.notice); // a trial this email already used
  window.location.href = answer.url;
} else {
  showMessage(answer.detail);                      // the shopper's sentence, as it is
}
```

- `plans()` lists the plans on sale with their monthly and yearly prices
  (`amount` in the currency's decimals, `unit_amount` in cents) and trial days.
  When `accepting_new` is false, show `message` instead of the buttons; the
  plans stay listed.
- `checkout()` never throws for a refusal. It resolves to
  `{ ok: false, status, code, detail }`: `already_subscribed`,
  `not_taking_new`, `store_not_ready`, `plan_not_found`,
  `no_price_for_period`, `return_url_not_allowed`, `stripe_error`, `invalid`,
  `throttled`, or `unreachable` (status 0) when the platform cannot be
  reached. `detail` is written for the shopper.
- `returnUrl` sets both addresses at once. `externalUserId` passes the store
  app's id for a buyer who came from inside it; `clientReferenceId` passes the
  app's own signed reference to Stripe untouched.
- `readCheckoutRefusal(err)` is exported for themes that call the endpoint
  through `http` themselves.

Works with the platform as it is: store subscriptions have been live since
2026-11-06. `clientReferenceId` is sent only when given, and the platform
passes it to Stripe from its next release (wave 4); until then it is ignored.

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

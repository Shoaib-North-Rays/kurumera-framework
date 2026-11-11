/**
 * The store's own subscription plans (KME-551): list them, and start a
 * checkout on the store's own Stripe account.
 *
 *   const { accepting_new, message, results } = await kurumera.subscriptions.plans();
 *   const answer = await kurumera.subscriptions.checkout({
 *     plan: "studio", period: "year", email,
 *     successUrl: "https://app.example.com/welcome",
 *     cancelUrl: "https://example.com/pricing",
 *   });
 *   if (answer.ok) window.location.href = answer.url;
 *   else showMessage(answer.detail);           // already the shopper's sentence
 *
 * The theme holds no key: the platform creates the Stripe checkout with the
 * store's own key, server side, and answers only its address.
 *
 * A refusal is an ordinary answer, not an exception: `checkout()` resolves to
 * `{ ok: false, code, detail }` for "already subscribed", "not taking new
 * subscribers", a throttle or the platform being unreachable. `detail` is
 * written for the shopper; show it as it is. `code` is for the theme's own
 * branching (for example, a sign-in link on `already_subscribed`).
 */
import type { Http } from "../http.js";
import { KurumeraError } from "../http.js";

export type SubscriptionPeriod = "month" | "year";

export interface SubscriptionPrice {
  /** In the currency's own decimals: "29.99", "4500", "1.250". */
  amount: string;
  /** The exact whole number Stripe charges, in the smallest unit (cents). */
  unit_amount: number;
  /** ISO code, e.g. "USD". */
  currency: string;
}

export interface SubscriptionPlan {
  id: string;
  /** The plan's key, e.g. "studio". Pass it to `checkout({ plan })`. */
  handle: string;
  name: string;
  description: string;
  /** The merchant's feature lines, in their order. */
  features: string[];
  /** Days free before the first payment; 0 for none. */
  trial_days: number;
  /** null when the plan is not offered for that period. */
  prices: { month: SubscriptionPrice | null; year: SubscriptionPrice | null };
}

export interface SubscriptionPlanList {
  /** Whether a checkout can start right now. The plans are listed either way. */
  accepting_new: boolean;
  /** When `accepting_new` is false: the sentence to show instead of the buttons. */
  message: string;
  /** Plans on sale, in the merchant's order. */
  results: SubscriptionPlan[];
}

export interface SubscriptionCheckoutInput {
  /** The plan's handle (or id). */
  plan: string;
  period: SubscriptionPeriod;
  /** The buyer's email. The subscription belongs to it. */
  email: string;
  /** Where the shopper lands after paying. Must be on the store's own site, over https. */
  successUrl?: string;
  /** Where they land if they leave Stripe's page. Same rule. */
  cancelUrl?: string;
  /** Both of the above at once, when they are the same page. */
  returnUrl?: string;
  /** The store's own app's id for this buyer, when they came from inside it. */
  externalUserId?: string;
  /**
   * The store app's own signed reference for a signed-in user (letters,
   * digits and . _ ~ -, up to 200). Passed to Stripe untouched; Kurumera
   * never reads it.
   */
  clientReferenceId?: string;
}

export type SubscriptionCheckoutAnswer =
  | {
      ok: true;
      /** Stripe's checkout page. Send the browser there. */
      url: string;
      sessionId: string;
      /** The trial this checkout gives; 0 when none. */
      trialDays: number;
      /**
       * Set when the plan has a trial this email already used: show it BEFORE
       * sending the shopper on, so the first charge is no surprise.
       */
      notice: string | null;
    }
  | {
      ok: false;
      /** HTTP status; 0 when the platform could not be reached. */
      status: number;
      /**
       * already_subscribed, not_taking_new, store_not_ready, plan_not_found,
       * no_price_for_period, return_url_not_allowed, stripe_error, invalid,
       * throttled, unreachable.
       */
      code: string;
      /** The shopper's sentence. Show it as it is. */
      detail: string;
    };

const THROTTLED = "Too many tries just now. Please wait a minute and try again.";
const UNREACHABLE = "We couldn't reach the store. Check your connection and try again.";
const UNKNOWN = "We couldn't start the payment. Please try again in a moment.";

/** A refused checkout as the platform said it: `{code, detail}` (or the error envelope). */
export function readCheckoutRefusal(err: unknown): SubscriptionCheckoutAnswer {
  if (!(err instanceof KurumeraError)) {
    return { ok: false, status: 0, code: "unreachable", detail: UNREACHABLE };
  }
  if (err.status === 429) return { ok: false, status: 429, code: "throttled", detail: THROTTLED };
  const body = (err.body ?? {}) as { code?: unknown; detail?: unknown; error?: { code?: unknown; message?: unknown } };
  const code = typeof body.code === "string" ? body.code : typeof body.error?.code === "string" ? body.error.code : err.code;
  const detail =
    typeof body.detail === "string" && body.detail ? body.detail
      : typeof body.error?.message === "string" && body.error.message ? body.error.message
        : UNKNOWN;
  return { ok: false, status: err.status, code, detail };
}

export function subscriptionsResource(http: Http) {
  return {
    /** GET /storefront/subscriptions/plans/ — the plans a pricing page shows. */
    plans: () => http.get<SubscriptionPlanList>("/storefront/subscriptions/plans/"),

    /**
     * POST /storefront/subscriptions/checkout/ — start a checkout on the
     * store's own Stripe. Never throws for a refusal or a lost connection;
     * read `ok`.
     */
    checkout: async (input: SubscriptionCheckoutInput): Promise<SubscriptionCheckoutAnswer> => {
      const body: Record<string, string> = { plan: input.plan, period: input.period, email: input.email };
      const success = input.successUrl ?? input.returnUrl;
      const cancel = input.cancelUrl ?? input.returnUrl;
      if (success) body.success_url = success;
      if (cancel) body.cancel_url = cancel;
      if (input.externalUserId) body.external_user_id = input.externalUserId;
      if (input.clientReferenceId) body.client_reference_id = input.clientReferenceId;
      try {
        const done = await http.post<{
          url: string; session_id: string; trial_days?: number; notice?: string;
        }>("/storefront/subscriptions/checkout/", body);
        return {
          ok: true,
          url: done.url,
          sessionId: done.session_id,
          trialDays: done.trial_days ?? 0,
          notice: done.notice || null,
        };
      } catch (err) {
        return readCheckoutRefusal(err);
      }
    },
  };
}

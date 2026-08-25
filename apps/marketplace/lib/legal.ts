/**
 * Commercial and legal constants — ONE definition, used by every document.
 *
 * Why this file exists.
 *
 * The terms page was 36 lines and silent on almost everything that actually
 * governs the relationship, and the numbers that DO govern it live in
 * `ops/push-service.mjs` and were written down nowhere a buyer or a creator
 * could read them. The worst example: a licence stops working at five stores
 * (`LICENSE_SEATS`, push-service.mjs:536) and no page said so. Someone pays
 * $300, installs on a sixth store, and discovers the limit from an error.
 *
 * So every figure below is mirrored from the code that enforces it, with the
 * enforcing line named. If one changes, both change, and the diff shows it.
 * Prose in the pages interpolates these — no number is typed twice.
 *
 * ── VALUES THAT ARE MINE TO WRITE DOWN ────────────────────────────────────
 * Anything marked FROM CODE is a fact about the running system. I read it out
 * of the service and it is not a matter of opinion.
 *
 * ── VALUES THAT ARE NOT ───────────────────────────────────────────────────
 * Anything marked REVIEW is a business or legal decision. I have put a
 * defensible default in so the pages are complete and coherent rather than
 * littered with "TBD", but they are NOT facts I can verify, and every one of
 * them is listed in the handover notes. `entity.registeredName`,
 * `entity.address` and `governingLaw` are deliberately EMPTY: a contract that
 * names the wrong counterparty or the wrong court is worse than one that is
 * quiet about it, and the components below omit the clause rather than print a
 * guess. Fill them in and the clauses appear.
 */

export const LEGAL_EFFECTIVE = "2026-08-25";

export const entity = {
  /** Trading name. Safe — this is the brand on every surface already. */
  tradingName: "Kurumera",

  /** REVIEW — registered company name. Empty until confirmed; see note above. */
  registeredName: "",

  /** REVIEW — registered address. Empty until confirmed. */
  address: "",

  /** REVIEW — company number, if the entity has one. */
  companyNumber: "",

  supportEmail: "support@kurumera.com",
  legalEmail: "support@kurumera.com",
} as const;

/** REVIEW — governing law and venue. Empty renders no jurisdiction clause. */
export const governingLaw = "";

/**
 * FROM CODE — push-service.mjs:246
 *   const PLATFORM_FEE_PCT = Math.min(90, Math.max(0, Number(env.KURUMERA_PLATFORM_FEE_PCT || 20)))
 * and the split applied at :430 and :683.
 */
export const PLATFORM_FEE_PCT = 20;
export const CREATOR_SHARE_PCT = 100 - PLATFORM_FEE_PCT;

/**
 * FROM CODE — push-service.mjs:536-544.
 *   const LICENSE_SEATS = Number(env.KURUMERA_LICENSE_SEATS || 5)
 * Re-installing into a store the licence already covers is free (:542); the
 * limit only bites on a NEW store. Both halves are documented, because the
 * second half is the reassuring one and it was invisible too.
 */
export const LICENSE_SEATS = 5;

/**
 * REVIEW — refund window.
 *
 * The mechanism is real and I verified it: a Stripe `charge.refunded` or
 * `charge.dispute.created` webhook revokes the licence (push-service.mjs:2243),
 * and a partial refund deliberately does not (:2250). What is NOT decided
 * anywhere is how long a buyer has to ask. 14 days matches the EU/UK statutory
 * withdrawal period for distance sales, which is the strictest regime likely to
 * apply, so it is the safe default rather than a generous one.
 */
export const REFUND_WINDOW_DAYS = 14;

/** FROM CODE — Stripe Connect Express, destination charges (:685, :2018). */
export const PAYOUT_PROVIDER = "Stripe";

/**
 * REVIEW — payout timing. Stripe Express defaults to a rolling schedule the
 * connected account controls, so this describes Stripe's default rather than a
 * promise Kurumera keeps independently. Phrased that way in the copy.
 */
export const PAYOUT_SCHEDULE = "Stripe's standard payout schedule for your country, typically every 2–7 days once your account is fully verified";

/** Currency all listings are priced and settled in. FROM CODE — Checkout uses USD. */
export const CURRENCY = "USD";

/** Formats a percentage for prose without a stray decimal. */
export const pct = (n: number) => `${n}%`;

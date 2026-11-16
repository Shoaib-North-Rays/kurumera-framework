import { notFound } from "next/navigation";
import { KurumeraError } from "@kurumera/storefront";
import { getStore, isDemo } from "@/lib/kurumera";
import { getSettings } from "@/lib/settings";
import { PlanPicker } from "@/components/PlanPicker";

/**
 * /plans — the store's subscription plans (monthly / yearly, on the store's own
 * Stripe). A store that sells no plans gets a 404 here, so the page exists only
 * where it means something; link to it from the store's menu in the admin.
 *
 * A store with its own app can send a signed-in user here as /plans?ref=<its
 * signed reference>. The reference rides along to Stripe untouched (Kurumera
 * never reads it), so the app's own Stripe webhook knows which of its users
 * paid. Only letters, digits and . _ ~ - (up to 200) are passed on; anything
 * else is dropped, as the platform would refuse it.
 */
const REFERENCE = /^[A-Za-z0-9._~-]{1,200}$/;

export async function generateMetadata() {
  const s = await getSettings();
  return { title: `Plans · ${s.storeName}` };
}

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string; ref?: string }>;
}) {
  const kurumera = await getStore();
  let list;
  try {
    list = await kurumera.subscriptions.plans();
  } catch (e) {
    if (e instanceof KurumeraError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
  if (!list.results.length) notFound();

  const { subscribed, ref } = await searchParams;
  const reference = typeof ref === "string" && REFERENCE.test(ref) ? ref : "";
  return (
    <section className="plans">
      <header className="plans__head">
        <h1 className="section__title">Choose your plan</h1>
        {subscribed === "1" ? (
          <p className="plans__notice plans__notice--done" role="status">
            Thank you — your subscription is active. Your receipt is on its way by email.
          </p>
        ) : !list.accepting_new ? (
          <p className="plans__notice" role="status">{list.message}</p>
        ) : null}
      </header>
      <PlanPicker plans={list.results} accepting={list.accepting_new}
        reference={reference} preview={isDemo()} />
    </section>
  );
}

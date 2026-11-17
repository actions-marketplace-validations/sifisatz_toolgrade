import "server-only";
import type Stripe from "stripe";
import type { Db } from "@/db/client";
import { subscriptions } from "@/db/schema";
import { PLANS, type PlanId } from "@/lib/plans";
import { planForPriceId, priceIdForPlan } from "@/lib/stripe";

export interface CheckoutArgs {
  organizationId: string;
  /** Required for a project-scoped plan (Early Access, Team); unused for an org-scoped one (Growth). */
  projectId?: string;
  plan: PlanId;
  successUrl: string;
  cancelUrl: string;
  /** An existing Stripe customer id for this org, if a prior subscription already created one. */
  existingCustomerId?: string;
}

/**
 * A Checkout Session for a paid plan. Deliberately does not touch the subscriptions table: the
 * subscription doesn't exist yet, and won't until Stripe tells us so via a webhook - reaching the
 * success_url on its own proves nothing (the tab could be closed, the browser killed, the webhook
 * delayed). See lib/stripe.ts's upsertFromSubscription for the actual write.
 */
export async function createCheckoutSession(
  stripe: Stripe,
  args: CheckoutArgs,
): Promise<{ url: string }> {
  const plan = PLANS[args.plan];
  if (plan.id === "free")
    throw new Error("the free plan has nothing to check out");
  if (plan.scope === "project" && !args.projectId)
    throw new Error(`plan "${plan.id}" needs a project`);
  const price = priceIdForPlan(plan.id);
  if (!price)
    throw new Error(
      `no Stripe price configured for plan "${plan.id}" (see README)`,
    );

  const metadata: Record<string, string> = {
    organizationId: args.organizationId,
    plan: plan.id,
  };
  if (args.projectId) metadata.projectId = args.projectId;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    client_reference_id: args.organizationId,
    subscription_data: { metadata },
    ...(args.existingCustomerId ? { customer: args.existingCustomerId } : {}),
  });
  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  return { url: session.url };
}

/** A Stripe-hosted billing portal session for an org that already has a Stripe customer. */
export async function createPortalSession(
  stripe: Stripe,
  args: { customerId: string; returnUrl: string },
): Promise<{ url: string }> {
  const session = await stripe.billingPortal.sessions.create({
    customer: args.customerId,
    return_url: args.returnUrl,
  });
  return { url: session.url };
}

/**
 * The single writer to the subscriptions table: applies a Stripe Subscription object (from
 * customer.subscription.created/updated/deleted - all three carry the same shape, and `.status`
 * already reflects "canceled" on delete) as an upsert keyed by providerSubscriptionId. A
 * subscription this project didn't create (no organizationId in its metadata) or whose price
 * isn't one of ours is ignored rather than guessed at.
 */
export async function upsertFromSubscription(
  db: Db,
  sub: Stripe.Subscription,
): Promise<void> {
  const item = sub.items.data[0];
  const plan: PlanId | undefined = item && planForPriceId(item.price.id);
  const organizationId = sub.metadata.organizationId;
  if (!item || !plan || !organizationId) return;

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const currentPeriodStart = new Date(item.current_period_start * 1000);
  const currentPeriodEnd = new Date(item.current_period_end * 1000);
  const projectId = sub.metadata.projectId || null;

  await db
    .insert(subscriptions)
    .values({
      organizationId,
      projectId,
      provider: "stripe",
      providerCustomerId: customerId,
      providerSubscriptionId: sub.id,
      plan,
      status: sub.status,
      currentPeriodStart,
      currentPeriodEnd,
    })
    .onConflictDoUpdate({
      target: subscriptions.providerSubscriptionId,
      set: {
        organizationId,
        projectId,
        providerCustomerId: customerId,
        plan,
        status: sub.status,
        currentPeriodStart,
        currentPeriodEnd,
        updatedAt: new Date(),
      },
    });
}

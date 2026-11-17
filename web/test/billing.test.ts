import type Stripe from "stripe";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { organization, projects, subscriptions } from "@/db/schema";
import {
  cancelSubscriptionsFor,
  createCheckoutSession,
  createPortalSession,
  upsertFromSubscription,
} from "@/lib/billing";
import { giveActivePlan } from "./helpers";

function fakeStripe(
  overrides: Partial<{
    checkoutCreate: unknown;
    portalCreate: unknown;
    subscriptionsCancel: unknown;
  }> = {},
): Stripe {
  return {
    checkout: {
      sessions: {
        create:
          overrides.checkoutCreate ??
          (async () => ({ url: "https://checkout.stripe.com/test" })),
      },
    },
    billingPortal: {
      sessions: {
        create:
          overrides.portalCreate ??
          (async () => ({ url: "https://billing.stripe.com/test" })),
      },
    },
    subscriptions: {
      cancel: overrides.subscriptionsCancel ?? (async () => ({})),
    },
  } as unknown as Stripe;
}

describe("createCheckoutSession", () => {
  it("rejects the free plan - there is nothing to check out", async () => {
    await expect(
      createCheckoutSession(fakeStripe(), {
        organizationId: "o1",
        plan: "free",
        successUrl: "https://x/ok",
        cancelUrl: "https://x/no",
      }),
    ).rejects.toThrow(/free plan/);
  });

  it("requires a projectId for a project-scoped plan", async () => {
    await expect(
      createCheckoutSession(fakeStripe(), {
        organizationId: "o1",
        plan: "early_access",
        successUrl: "https://x/ok",
        cancelUrl: "https://x/no",
      }),
    ).rejects.toThrow(/needs a project/);
  });

  it("does not require a projectId for an org-scoped plan (growth)", async () => {
    const result = await createCheckoutSession(fakeStripe(), {
      organizationId: "o1",
      plan: "growth",
      successUrl: "https://x/ok",
      cancelUrl: "https://x/no",
    });
    expect(result.url).toBe("https://checkout.stripe.com/test");
  });

  it("sends the configured price, metadata and an existing customer id when given", async () => {
    let sent: Stripe.Checkout.SessionCreateParams | undefined;
    const stripe = fakeStripe({
      checkoutCreate: async (params: Stripe.Checkout.SessionCreateParams) => {
        sent = params;
        return { url: "https://checkout.stripe.com/test" };
      },
    });
    await createCheckoutSession(stripe, {
      organizationId: "org-1",
      projectId: "proj-1",
      plan: "team",
      successUrl: "https://x/ok",
      cancelUrl: "https://x/no",
      existingCustomerId: "cus_123",
    });
    expect(sent?.line_items).toEqual([
      { price: "price_test_team", quantity: 1 },
    ]);
    expect(sent?.customer).toBe("cus_123");
    expect(sent?.subscription_data?.metadata).toEqual({
      organizationId: "org-1",
      projectId: "proj-1",
      plan: "team",
    });
  });

  it("throws when no Stripe price is configured for the plan", async () => {
    const original = process.env.STRIPE_PRICE_TEAM;
    delete process.env.STRIPE_PRICE_TEAM;
    try {
      await expect(
        createCheckoutSession(fakeStripe(), {
          organizationId: "o1",
          projectId: "p1",
          plan: "team",
          successUrl: "https://x/ok",
          cancelUrl: "https://x/no",
        }),
      ).rejects.toThrow(/no Stripe price configured/);
    } finally {
      if (original) process.env.STRIPE_PRICE_TEAM = original;
    }
  });
});

describe("createPortalSession", () => {
  it("creates a portal session for the given customer", async () => {
    let sent: Stripe.BillingPortal.SessionCreateParams | undefined;
    const stripe = fakeStripe({
      portalCreate: async (
        params: Stripe.BillingPortal.SessionCreateParams,
      ) => {
        sent = params;
        return { url: "https://billing.stripe.com/test" };
      },
    });
    const result = await createPortalSession(stripe, {
      customerId: "cus_123",
      returnUrl: "https://x/back",
    });
    expect(result.url).toBe("https://billing.stripe.com/test");
    expect(sent).toEqual({ customer: "cus_123", return_url: "https://x/back" });
  });
});

function fakeSubscription(
  overrides: Partial<Stripe.Subscription> & {
    priceId?: string;
    periodStart?: number;
    periodEnd?: number;
  } = {},
): Stripe.Subscription {
  const {
    priceId = "price_test_early_access",
    periodStart = 1700000000,
    periodEnd = 1702592000,
    ...rest
  } = overrides;
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    metadata: { organizationId: "org-1" },
    items: {
      data: [
        {
          price: { id: priceId },
          current_period_start: periodStart,
          current_period_end: periodEnd,
        },
      ],
    },
    ...rest,
  } as unknown as Stripe.Subscription;
}

describe("upsertFromSubscription", () => {
  let orgId: string;

  beforeAll(async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organization)
      .values({ slug: "billing-test", name: "Billing Test" })
      .returning();
    orgId = org!.id;
  });

  it("maps the subscription's price to a plan, and upserts on repeat events for the same subscription id", async () => {
    const db = await getDb();
    const sub = fakeSubscription({
      id: "sub_upsert_1",
      metadata: { organizationId: orgId },
      priceId: "price_test_early_access",
    });
    await upsertFromSubscription(db, sub);
    let rows = await db.select().from(subscriptions);
    let row = rows.find((r) => r.providerSubscriptionId === "sub_upsert_1");
    expect(row).toMatchObject({
      plan: "early_access",
      status: "active",
      organizationId: orgId,
      providerCustomerId: "cus_1",
    });

    // A later event for the same subscription (e.g. upgraded via the billing portal, then canceled).
    await upsertFromSubscription(
      db,
      fakeSubscription({
        id: "sub_upsert_1",
        metadata: { organizationId: orgId },
        priceId: "price_test_team",
        status: "active",
      }),
    );
    rows = await db.select().from(subscriptions);
    expect(
      rows.filter((r) => r.providerSubscriptionId === "sub_upsert_1"),
    ).toHaveLength(1);
    row = rows.find((r) => r.providerSubscriptionId === "sub_upsert_1");
    expect(row?.plan).toBe("team");

    await upsertFromSubscription(
      db,
      fakeSubscription({
        id: "sub_upsert_1",
        metadata: { organizationId: orgId },
        priceId: "price_test_team",
        status: "canceled",
      }),
    );
    rows = await db.select().from(subscriptions);
    row = rows.find((r) => r.providerSubscriptionId === "sub_upsert_1");
    expect(row?.status).toBe("canceled");
  });

  it("ignores a subscription with no organizationId in its metadata", async () => {
    const db = await getDb();
    await upsertFromSubscription(
      db,
      fakeSubscription({ id: "sub_no_org", metadata: {} }),
    );
    const rows = await db.select().from(subscriptions);
    expect(
      rows.find((r) => r.providerSubscriptionId === "sub_no_org"),
    ).toBeUndefined();
  });

  it("ignores a subscription whose price isn't one of our configured plans", async () => {
    const db = await getDb();
    await upsertFromSubscription(
      db,
      fakeSubscription({
        id: "sub_unknown_price",
        metadata: { organizationId: orgId },
        priceId: "price_not_ours",
      }),
    );
    const rows = await db.select().from(subscriptions);
    expect(
      rows.find((r) => r.providerSubscriptionId === "sub_unknown_price"),
    ).toBeUndefined();
  });

  it("carries projectId through from metadata for a project-scoped plan", async () => {
    const db = await getDb();
    const [project] = await db
      .insert(projects)
      .values({ orgId, slug: "bt-p", name: "P" })
      .returning();
    await upsertFromSubscription(
      db,
      fakeSubscription({
        id: "sub_with_project",
        metadata: { organizationId: orgId, projectId: project!.id },
      }),
    );
    const rows = await db.select().from(subscriptions);
    const row = rows.find(
      (r) => r.providerSubscriptionId === "sub_with_project",
    );
    expect(row?.projectId).toBe(project!.id);
  });
});

describe("cancelSubscriptionsFor", () => {
  it("does nothing when the org has no subscriptions to cancel", async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organization)
      .values({ slug: "cancel-none", name: "Cancel None" })
      .returning();
    await expect(
      cancelSubscriptionsFor(db, { organizationId: org!.id }),
    ).resolves.toBeUndefined();
  });

  it("cancels every active subscription recorded for an org", async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organization)
      .values({ slug: "cancel-org", name: "Cancel Org" })
      .returning();
    await giveActivePlan(db, org!.id, "growth");
    const cancel = vi.fn(async () => ({}));
    await cancelSubscriptionsFor(
      db,
      { organizationId: org!.id },
      fakeStripe({ subscriptionsCancel: cancel }),
    );
    expect(cancel).toHaveBeenCalledWith(`sub_test_${org!.id}_org`);
  });

  it("only cancels the given project's subscription, not its org's other ones", async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organization)
      .values({ slug: "cancel-scope", name: "Cancel Scope" })
      .returning();
    const [project] = await db
      .insert(projects)
      .values({ orgId: org!.id, slug: "p", name: "P" })
      .returning();
    await giveActivePlan(db, org!.id, "team", project!.id);
    await giveActivePlan(db, org!.id, "growth"); // org-scoped, no projectId
    const cancel = vi.fn(async () => ({}));
    await cancelSubscriptionsFor(
      db,
      { projectId: project!.id },
      fakeStripe({ subscriptionsCancel: cancel }),
    );
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith(`sub_test_${org!.id}_${project!.id}`);
  });

  it("does not re-cancel a subscription that is already canceled", async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organization)
      .values({ slug: "cancel-already", name: "Cancel Already" })
      .returning();
    await db.insert(subscriptions).values({
      organizationId: org!.id,
      provider: "stripe",
      providerSubscriptionId: "sub_already_canceled",
      plan: "team",
      status: "canceled",
    });
    const cancel = vi.fn(async () => ({}));
    await cancelSubscriptionsFor(
      db,
      { organizationId: org!.id },
      fakeStripe({ subscriptionsCancel: cancel }),
    );
    expect(cancel).not.toHaveBeenCalled();
  });
});

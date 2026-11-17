import Stripe from "stripe";
import { beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/stripe/webhook/route";
import { getDb } from "@/db/client";
import { organization, subscriptions } from "@/db/schema";

const SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

function subscriptionEvent(
  type: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: overrides.eventId ?? `evt_${Math.random().toString(36).slice(2)}`,
    type,
    data: {
      object: {
        id: "sub_webhook_1",
        customer: "cus_webhook_1",
        status:
          type === "customer.subscription.deleted" ? "canceled" : "active",
        metadata: {
          organizationId: overrides.organizationId ?? "org-placeholder",
        },
        items: {
          data: [
            {
              price: { id: "price_test_early_access" },
              current_period_start: 1700000000,
              current_period_end: 1702592000,
            },
          ],
        },
        ...overrides,
      },
    },
  };
}

function sign(payload: string): string {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
}

function post(payload: string, signature?: string) {
  return POST(
    new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: signature ? { "stripe-signature": signature } : {},
      body: payload,
    }),
  );
}

describe("POST /api/stripe/webhook", () => {
  let orgId: string;

  beforeAll(async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organization)
      .values({ slug: "webhook-test", name: "Webhook Test" })
      .returning();
    orgId = org!.id;
  });

  it("rejects a request with no stripe-signature header", async () => {
    const res = await post("{}");
    expect(res.status).toBe(400);
  });

  it("rejects a bad signature", async () => {
    const res = await post(
      JSON.stringify(subscriptionEvent("customer.subscription.created")),
      "t=1,v1=not-a-real-signature",
    );
    expect(res.status).toBe(400);
  });

  it("applies a subscription.created event and stores the subscription", async () => {
    const payload = JSON.stringify(
      subscriptionEvent("customer.subscription.created", {
        organizationId: orgId,
        eventId: "evt_created_1",
      }),
    );
    const res = await post(payload, sign(payload));
    expect(res.status).toBe(200);

    const db = await getDb();
    const rows = await db.select().from(subscriptions);
    const row = rows.find((r) => r.providerSubscriptionId === "sub_webhook_1");
    expect(row).toMatchObject({
      organizationId: orgId,
      plan: "early_access",
      status: "active",
    });
  });

  it("does not re-apply a duplicate delivery of the same event id", async () => {
    const payload = JSON.stringify(
      subscriptionEvent("customer.subscription.updated", {
        organizationId: orgId,
        eventId: "evt_created_1",
        status: "past_due",
      }),
    );
    const res = await post(payload, sign(payload));
    const body = (await res.json()) as { duplicate?: boolean };
    expect(body.duplicate).toBe(true);

    const db = await getDb();
    const rows = await db.select().from(subscriptions);
    // Still "active" from the first event - the duplicate (same event id) must not have re-applied.
    expect(
      rows.find((r) => r.providerSubscriptionId === "sub_webhook_1")?.status,
    ).toBe("active");
  });

  it("acknowledges an event type it does not act on, without erroring", async () => {
    const payload = JSON.stringify({
      id: "evt_unhandled_1",
      type: "invoice.payment_succeeded",
      data: { object: {} },
    });
    const res = await post(payload, sign(payload));
    expect(res.status).toBe(200);
  });

  it("marks a subscription canceled on customer.subscription.deleted", async () => {
    const payload = JSON.stringify(
      subscriptionEvent("customer.subscription.deleted", {
        organizationId: orgId,
        eventId: "evt_deleted_1",
        id: "sub_webhook_1",
      }),
    );
    const res = await post(payload, sign(payload));
    expect(res.status).toBe(200);

    const db = await getDb();
    const rows = await db.select().from(subscriptions);
    expect(
      rows.find((r) => r.providerSubscriptionId === "sub_webhook_1")?.status,
    ).toBe("canceled");
  });
});

import type Stripe from "stripe";
import { getDb } from "@/db/client";
import { stripeEvents } from "@/db/schema";
import { recordEvent } from "@/lib/analytics";
import { upsertFromSubscription } from "@/lib/billing";
import { logError, logInfo, logWarn, newRequestId } from "@/lib/logger";
import { getStripe, planForPriceId, requireWebhookSecret } from "@/lib/stripe";

const json = (body: unknown, status = 200) => Response.json(body, { status });

// Subscription events carry the full Stripe.Subscription object in all three cases (including
// "deleted", whose object's own `status` is already "canceled") - one handler, see
// lib/billing.ts's upsertFromSubscription. Everything else is acknowledged but ignored: Stripe
// retries indefinitely on anything but a 2xx, so an event type we don't act on must still 200.
const HANDLED_TYPES = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export async function POST(request: Request) {
  const requestId = newRequestId();
  const startedAt = Date.now();
  const category = "stripe-webhook";

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    logWarn("stripe webhook rejected: missing stripe-signature header", {
      requestId,
      category,
    });
    return json({ error: "missing stripe-signature header" }, 400);
  }

  // Signature verification needs the exact raw bytes Stripe signed - never JSON.parse first.
  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      requireWebhookSecret(),
    );
  } catch (err) {
    logWarn("stripe webhook rejected: invalid signature", {
      requestId,
      category,
      error: err instanceof Error ? err.message : String(err),
    });
    return json(
      {
        error: `invalid signature: ${err instanceof Error ? err.message : String(err)}`,
      },
      400,
    );
  }

  const db = await getDb();
  // The idempotency marker and the actual effect commit together: if upsertFromSubscription
  // throws, the marker insert rolls back too, so a retried delivery still sees this event as
  // unprocessed and tries again - recording "done" before confirming it actually succeeded would
  // mean a transient failure is never retried, only logged and quietly dropped.
  let outcome: "duplicate" | "processed" | "failed";
  try {
    outcome = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(stripeEvents)
        .values({ id: event.id })
        .onConflictDoNothing()
        .returning({ id: stripeEvents.id });
      if (inserted.length === 0) return "duplicate" as const;
      if (HANDLED_TYPES.has(event.type)) {
        const sub = event.data.object as Stripe.Subscription;
        await upsertFromSubscription(tx, sub);
        if (event.type === "customer.subscription.created") {
          const item = sub.items.data[0];
          const plan = item && planForPriceId(item.price.id);
          if (plan && sub.metadata.organizationId) {
            await recordEvent(tx, {
              name: "subscription_started",
              organizationId: sub.metadata.organizationId,
              projectId: sub.metadata.projectId || undefined,
              properties: { plan },
            });
          }
        }
      }
      return "processed" as const;
    });
  } catch (err) {
    logError("stripe webhook handler failed", {
      requestId,
      category,
      eventType: event.type,
      error: err instanceof Error ? err.message : String(err),
    });
    outcome = "failed";
  }

  if (outcome === "failed") {
    // Non-2xx so Stripe retries with backoff - this is a bug or outage to fix, not something to
    // paper over by acknowledging an event we never actually applied.
    return json({ error: "internal error processing webhook" }, 500);
  }
  if (outcome === "duplicate") {
    logInfo("stripe webhook duplicate delivery ignored", {
      requestId,
      category,
      eventType: event.type,
    });
    return json({ received: true, duplicate: true });
  }

  logInfo("stripe webhook processed", {
    requestId,
    category,
    eventType: event.type,
    durationMs: Date.now() - startedAt,
  });
  return json({ received: true });
}

import type Stripe from "stripe";
import { getDb } from "@/db/client";
import { stripeEvents } from "@/db/schema";
import { upsertFromSubscription } from "@/lib/billing";
import { getStripe, requireWebhookSecret } from "@/lib/stripe";

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
  const signature = request.headers.get("stripe-signature");
  if (!signature)
    return json({ error: "missing stripe-signature header" }, 400);

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
    return json(
      {
        error: `invalid signature: ${err instanceof Error ? err.message : String(err)}`,
      },
      400,
    );
  }

  const db = await getDb();
  // A retried delivery (Stripe retries on anything but 2xx) or a duplicate send must not re-apply
  // its effect - this insert is the idempotency check, atomic with no separate read-then-write race.
  const inserted = await db
    .insert(stripeEvents)
    .values({ id: event.id })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id });
  if (inserted.length === 0) return json({ received: true, duplicate: true });

  if (HANDLED_TYPES.has(event.type)) {
    await upsertFromSubscription(db, event.data.object as Stripe.Subscription);
  }

  return json({ received: true });
}

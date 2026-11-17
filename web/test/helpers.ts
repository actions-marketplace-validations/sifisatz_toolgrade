import type { Db } from "@/db/client";
import { subscriptions } from "@/db/schema";
import type { PlanId } from "@/lib/plans";

/**
 * Most tests that exercise the ingest endpoint only care about something other than billing
 * (schema validation, auth, size limits...), so they need a project that is not on the free
 * plan's zero hosted allowance. A fake Stripe subscription id keeps this out of the way of real
 * subscription ids (see lib/billing.ts's upsertFromSubscription, which is keyed on that column).
 */
export async function giveActivePlan(
  db: Db,
  organizationId: string,
  plan: PlanId = "team",
  projectId?: string,
): Promise<void> {
  await db.insert(subscriptions).values({
    organizationId,
    projectId: projectId ?? null,
    provider: "stripe",
    providerSubscriptionId: `sub_test_${organizationId}_${projectId ?? "org"}`,
    plan,
    status: "active",
    currentPeriodStart: new Date("2020-01-01"),
    currentPeriodEnd: new Date("2999-01-01"),
  });
}

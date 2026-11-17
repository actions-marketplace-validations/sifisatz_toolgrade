import { and, eq, isNull, or } from "drizzle-orm";
import type { Db } from "@/db/client";
import { subscriptions } from "@/db/schema";
import { isPlanId, PLANS, type Plan, type PlanId } from "@/lib/plans";

// A subscription past its payment due date is still entitled: Stripe gives it a grace period
// before it moves to "canceled", and locking a project out mid-grace is a worse experience than
// a late webhook catching up a few hours later. Only a row in one of these statuses counts.
const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

export interface Entitlements {
  plan: Plan;
  /** Present only when a paid subscription (not the free plan) granted this. */
  subscriptionId?: string;
  status?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}

const FREE: Entitlements = { plan: PLANS.free };

/**
 * The plan in effect for a project, in one org-scoped query: an org-level (Growth) subscription
 * covers every project and wins over a project-level one; with neither, the plan is free.
 *
 * This only answers "what does this org/project get" - it does not enforce any limit (max
 * projects, monthly units, retention). Enforcement reads these numbers at the point that matters
 * (e.g. report ingestion, project creation) rather than living here.
 */
export async function getEntitlements(
  db: Db,
  orgId: string,
  projectId?: string,
): Promise<Entitlements> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.organizationId, orgId),
        projectId
          ? or(
              isNull(subscriptions.projectId),
              eq(subscriptions.projectId, projectId),
            )
          : isNull(subscriptions.projectId),
      ),
    );

  const entitled = rows.filter(
    (r) => ENTITLED_STATUSES.has(r.status) && isPlanId(r.plan),
  );
  const row =
    entitled.find((r) => r.projectId === null) ??
    entitled.find((r) => r.projectId === projectId);
  if (!row) return FREE;
  return {
    plan: PLANS[row.plan as PlanId],
    subscriptionId: row.id,
    status: row.status,
    currentPeriodStart: row.currentPeriodStart ?? undefined,
    currentPeriodEnd: row.currentPeriodEnd ?? undefined,
  };
}

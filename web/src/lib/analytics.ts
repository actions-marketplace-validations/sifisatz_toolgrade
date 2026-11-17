import type { Db } from "@/db/client";
import { productEvents } from "@/db/schema";
import { logError } from "@/lib/logger";

// The activation/monetization funnel, recorded straight into Postgres (see schema.ts's
// productEvents) instead of a third-party analytics vendor - no new infrastructure, no account to
// create, no user data leaving the stack. Query it with scripts/growth-report.ts.
export type ProductEventName =
  | "org_created"
  | "project_created"
  | "api_key_created"
  | "run_ingested"
  | "checkout_started"
  | "subscription_started";

export interface ProductEvent {
  name: ProductEventName;
  userId?: string;
  organizationId?: string;
  projectId?: string;
  properties?: Record<string, unknown>;
}

/**
 * Best-effort: a failed insert is logged, never thrown - an analytics event must never break the
 * request that triggered it (signup, checkout, an ingest upload a CI job is waiting on).
 */
export async function recordEvent(db: Db, event: ProductEvent): Promise<void> {
  try {
    await db.insert(productEvents).values({
      name: event.name,
      userId: event.userId,
      organizationId: event.organizationId,
      projectId: event.projectId,
      properties: event.properties ?? {},
    });
  } catch (err) {
    logError("analytics event could not be recorded", {
      category: "analytics",
      name: event.name,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

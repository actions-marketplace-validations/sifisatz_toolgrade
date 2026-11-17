import { and, between, eq, sum } from "drizzle-orm";
import type { RunReport } from "toolgrade/core";
import type { Db } from "@/db/client";
import { runs } from "@/db/schema";

/**
 * One evaluation unit = one task evaluated across both arms for one trial - see the pricing
 * model in docs/PLAN.md. A (task, trial) only counts if every arm that actually ran for it
 * completed without an error: a task with no baseline arm (not all tasks get one, see
 * isOutcomeAssertion in config.ts) is unaffected by that, but an errored trial in either arm
 * means the pair was never really evaluated and should not be billed.
 */
export function billableUnits(report: RunReport): number {
  const ok = new Map<string, boolean>();
  for (const t of report.trials) {
    const key = `${t.taskId}\u0000${t.trial}`;
    ok.set(key, (ok.get(key) ?? true) && !t.error);
  }
  let count = 0;
  for (const v of ok.values()) if (v) count++;
  return count;
}

/** Total billable units for a project's runs created within [since, until]. */
export async function getUsage(
  db: Db,
  projectId: string,
  since: Date,
  until: Date,
): Promise<number> {
  const [row] = await db
    .select({ total: sum(runs.billableUnits) })
    .from(runs)
    .where(
      and(eq(runs.projectId, projectId), between(runs.createdAt, since, until)),
    );
  return Number(row?.total ?? 0);
}

/** The calendar-month window containing `at` (default now) - the free plan's usage period, since it has no subscription to read a billing period from. */
export function currentCalendarMonth(at: Date = new Date()): {
  since: Date;
  until: Date;
} {
  const since = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const until = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1) - 1,
  );
  return { since, until };
}

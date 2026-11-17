import { and, desc, eq, gte, like, lt, lte, or } from "drizzle-orm";
import type { Db } from "@/db/client";
import { runs } from "@/db/schema";

// Plain, db-first-argument functions (no next/server's connection(), which only works inside a
// real request) - this is what's actually unit tested. lib/data.ts's listRunsFiltered/
// listRunFilterOptions are thin connection()-wrapped callers of these, same split as
// lib/usage.ts's getUsageStatus and lib/entitlements.ts's getEntitlements.

export const runSummaryColumns = {
  id: runs.id,
  createdAt: runs.createdAt,
  source: runs.source,
  provider: runs.provider,
  agentModel: runs.agentModel,
  trialsPerTask: runs.trialsPerTask,
  taskCount: runs.taskCount,
  passRate: runs.passRate,
  passLow: runs.passLow,
  passHigh: runs.passHigh,
  baselineRate: runs.baselineRate,
  lift: runs.lift,
  liftLow: runs.liftLow,
  liftHigh: runs.liftHigh,
  liftSignificance: runs.liftSignificance,
  gatePassed: runs.gatePassed,
  errors: runs.errors,
  totalCostUsd: runs.totalCostUsd,
  branch: runs.branch,
  commit: runs.commit,
  commitMessage: runs.commitMessage,
};

export interface RunFilters {
  suite?: string;
  provider?: string;
  agentModel?: string;
  branch?: string;
  /** Prefix match, since users usually copy a short sha, not the full 40 characters. */
  commit?: string;
  gatePassed?: boolean;
  since?: Date;
  until?: Date;
}

/** An opaque pagination cursor: the last row's (createdAt, id) from the previous page. */
export interface RunCursor {
  createdAt: Date;
  id: string;
}

/**
 * Filtered, cursor-paginated run history for the dedicated /runs page - unlike listRuns (the
 * project overview's quick "latest 100" glance), this never silently caps at a fixed count: it
 * fetches one page at a time and says whether there's another.
 */
export async function queryRunsFiltered(
  db: Db,
  projectId: string,
  filters: RunFilters,
  cursor?: RunCursor,
  pageSize = 50,
) {
  const conditions = [eq(runs.projectId, projectId)];
  if (filters.suite) conditions.push(eq(runs.suite, filters.suite));
  if (filters.provider) conditions.push(eq(runs.provider, filters.provider));
  if (filters.agentModel)
    conditions.push(eq(runs.agentModel, filters.agentModel));
  if (filters.branch) conditions.push(eq(runs.branch, filters.branch));
  if (filters.commit) conditions.push(like(runs.commit, `${filters.commit}%`));
  if (filters.gatePassed !== undefined)
    conditions.push(eq(runs.gatePassed, filters.gatePassed));
  if (filters.since) conditions.push(gte(runs.createdAt, filters.since));
  if (filters.until) conditions.push(lte(runs.createdAt, filters.until));
  if (cursor) {
    conditions.push(
      or(
        lt(runs.createdAt, cursor.createdAt),
        and(eq(runs.createdAt, cursor.createdAt), lt(runs.id, cursor.id)),
      )!,
    );
  }

  const rows = await db
    .select(runSummaryColumns)
    .from(runs)
    .where(and(...conditions))
    .orderBy(desc(runs.createdAt), desc(runs.id))
    .limit(pageSize + 1);

  const hasMore = rows.length > pageSize;
  const page = rows.slice(0, pageSize);
  const last = page.at(-1);
  return {
    rows: page,
    hasMore,
    nextCursor:
      hasMore && last ? { createdAt: last.createdAt, id: last.id } : undefined,
  };
}

/** Distinct values seen for this project, to populate the run-history filter selects. */
export async function queryRunFilterOptions(db: Db, projectId: string) {
  const [suites, providers, models, branches] = await Promise.all([
    db
      .selectDistinct({ v: runs.suite })
      .from(runs)
      .where(eq(runs.projectId, projectId)),
    db
      .selectDistinct({ v: runs.provider })
      .from(runs)
      .where(eq(runs.projectId, projectId)),
    db
      .selectDistinct({ v: runs.agentModel })
      .from(runs)
      .where(eq(runs.projectId, projectId)),
    db
      .selectDistinct({ v: runs.branch })
      .from(runs)
      .where(eq(runs.projectId, projectId)),
  ]);
  const strings = (rows: Array<{ v: string | null }>) =>
    rows
      .map((r) => r.v)
      .filter((v): v is string => v !== null)
      .sort();
  return {
    suites: strings(suites),
    providers: strings(providers),
    models: strings(models),
    branches: strings(branches),
  };
}

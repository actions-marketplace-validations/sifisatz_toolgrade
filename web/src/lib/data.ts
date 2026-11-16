import "server-only";
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  lte,
  sql,
} from "drizzle-orm";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db/client";
import { apiKeys, orgs, projects, runs } from "@/db/schema";

// Every read is request-time (connection()) and org-scoped: a project is only ever looked up
// through the org that owns it. cache() de-duplicates identical lookups within one request
// (the layout and the page both ask for the org and its projects).

const TREND_POINTS = 20;

const runSummaryColumns = {
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

export type RunSummary = Awaited<ReturnType<typeof listRuns>>[number];

export const getOrg = cache(async (slug: string) => {
  await connection();
  const db = await getDb();
  const [org] = await db
    .select()
    .from(orgs)
    .where(eq(orgs.slug, slug))
    .limit(1);
  return org;
});

export const getProject = cache(
  async (orgSlug: string, projectSlug: string) => {
    await connection();
    const db = await getDb();
    const [row] = await db
      .select({ project: projects, org: orgs })
      .from(projects)
      .innerJoin(orgs, eq(projects.orgId, orgs.id))
      .where(and(eq(orgs.slug, orgSlug), eq(projects.slug, projectSlug)))
      .limit(1);
    return row;
  },
);

/** Projects with their run count and only the last TREND_POINTS runs each. */
export const listProjects = cache(async (orgId: string) => {
  await connection();
  const db = await getDb();
  const list = await db
    .select()
    .from(projects)
    .where(eq(projects.orgId, orgId))
    .orderBy(projects.name);
  if (list.length === 0) return [];
  const ids = list.map((p) => p.id);

  const counts = await db
    .select({ projectId: runs.projectId, n: count() })
    .from(runs)
    .where(inArray(runs.projectId, ids))
    .groupBy(runs.projectId);
  const ranked = db.$with("ranked").as(
    db
      .select({
        projectId: runs.projectId,
        ...runSummaryColumns,
        rn: sql<number>`row_number() over (partition by ${runs.projectId} order by ${runs.createdAt} desc)`.as(
          "rn",
        ),
      })
      .from(runs)
      .where(inArray(runs.projectId, ids)),
  );
  const recent = await db
    .with(ranked)
    .select()
    .from(ranked)
    .where(lte(ranked.rn, TREND_POINTS))
    .orderBy(desc(ranked.createdAt));

  return list.map((p) => {
    const mine = recent.filter((r) => r.projectId === p.id);
    return {
      ...p,
      latest: mine[0],
      runCount: Number(counts.find((c) => c.projectId === p.id)?.n ?? 0),
      trend: mine.map((r) => r.passRate).reverse(),
    };
  });
});

export async function listRuns(projectId: string, limit = 100) {
  await connection();
  const db = await getDb();
  return db
    .select(runSummaryColumns)
    .from(runs)
    .where(eq(runs.projectId, projectId))
    .orderBy(desc(runs.createdAt))
    .limit(limit);
}

export async function getRun(projectId: string, runId: string) {
  await connection();
  if (!/^[0-9a-f-]{36}$/i.test(runId)) return undefined;
  const db = await getDb();
  const [run] = await db
    .select()
    .from(runs)
    .where(and(eq(runs.projectId, projectId), eq(runs.id, runId)))
    .limit(1);
  return run;
}

/** The run immediately before the given time in the same project, for "vs previous" links. */
export async function getPreviousRunId(projectId: string, before: Date) {
  await connection();
  const db = await getDb();
  const [prev] = await db
    .select({ id: runs.id })
    .from(runs)
    .where(and(eq(runs.projectId, projectId), lt(runs.createdAt, before)))
    .orderBy(desc(runs.createdAt))
    .limit(1);
  return prev?.id;
}

export async function listApiKeys(projectId: string) {
  await connection();
  const db = await getDb();
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.projectId, projectId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));
}

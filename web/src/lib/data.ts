import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { apiKeys, orgs, projects, runs } from "@/db/schema";

// Every read is request-time (connection()) and org-scoped: a project is only ever looked up
// through the org that owns it.

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

export async function getOrg(slug: string) {
  await connection();
  const db = await getDb();
  const [org] = await db
    .select()
    .from(orgs)
    .where(eq(orgs.slug, slug))
    .limit(1);
  return org;
}

export async function getProject(orgSlug: string, projectSlug: string) {
  await connection();
  const db = await getDb();
  const [row] = await db
    .select({ project: projects, org: orgs })
    .from(projects)
    .innerJoin(orgs, eq(projects.orgId, orgs.id))
    .where(and(eq(orgs.slug, orgSlug), eq(projects.slug, projectSlug)))
    .limit(1);
  return row;
}

export async function listProjects(orgId: string) {
  await connection();
  const db = await getDb();
  const list = await db
    .select()
    .from(projects)
    .where(eq(projects.orgId, orgId))
    .orderBy(projects.name);
  if (list.length === 0) return [];
  const recent = await db
    .select({ projectId: runs.projectId, ...runSummaryColumns })
    .from(runs)
    .where(
      inArray(
        runs.projectId,
        list.map((p) => p.id),
      ),
    )
    .orderBy(desc(runs.createdAt));
  return list.map((p) => {
    const mine = recent.filter((r) => r.projectId === p.id);
    return {
      ...p,
      latest: mine[0],
      runCount: mine.length,
      trend: mine
        .slice(0, 20)
        .reverse()
        .map((r) => r.passRate),
    };
  });
}

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

/** The run immediately before this one in the same project, for "vs previous" deltas. */
export async function getPreviousRunId(projectId: string, runId: string) {
  const list = await listRuns(projectId, 1000);
  const i = list.findIndex((r) => r.id === runId);
  return i >= 0 ? list[i + 1]?.id : undefined;
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

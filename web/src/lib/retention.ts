import "server-only";
import { and, eq, lt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { projects, runs } from "@/db/schema";
import { getEntitlements } from "@/lib/entitlements";

export interface RetentionResult {
  projectsChecked: number;
  projectsCleaned: number;
  runsDeleted: number;
}

/**
 * Deletes runs older than each project's *current* plan's retention window (early_access: 90
 * days, team/growth: 365). Re-resolves entitlements per project at cleanup time rather than
 * trusting anything cached, so an upgrade mid-cycle is honoured immediately and nothing within
 * the new, larger window is ever at risk.
 *
 * A plan with no numeric retention (free, or no entitlement at all - retentionDays is null) is
 * skipped entirely: this never deletes data because a window is *undefined*, only because a
 * concrete number of days says it has expired. In practice a free-tier project has no hosted runs
 * to begin with (see the usage-limit enforcement in api/v1/runs), so this mainly matters for a
 * project whose paid subscription lapsed - its existing history is left alone rather than purged.
 */
export async function cleanupExpiredRuns(
  db: Db,
  now: Date = new Date(),
): Promise<RetentionResult> {
  const allProjects = await db
    .select({ id: projects.id, orgId: projects.orgId })
    .from(projects);

  let projectsCleaned = 0;
  let runsDeleted = 0;
  for (const project of allProjects) {
    const entitlements = await getEntitlements(db, project.orgId, project.id);
    const days = entitlements.plan.retentionDays;
    if (days === null) continue;

    const cutoff = new Date(now.getTime() - days * 86_400_000);
    const deleted = await db
      .delete(runs)
      .where(and(eq(runs.projectId, project.id), lt(runs.createdAt, cutoff)))
      .returning({ id: runs.id });
    if (deleted.length > 0) {
      projectsCleaned++;
      runsDeleted += deleted.length;
    }
  }

  return { projectsChecked: allProjects.length, projectsCleaned, runsDeleted };
}

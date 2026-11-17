import { join } from "node:path";
import { loadSuite, runSuite, ScriptedProvider } from "toolgrade";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { organization, projects, runs } from "@/db/schema";
import { toRunRow, UploadSchema } from "@/lib/ingest";
import { cleanupExpiredRuns } from "@/lib/retention";
import { notesAgent } from "../../examples/scripted-agent";
import { giveActivePlan } from "./helpers";

const SUITE = join(
  import.meta.dirname,
  "..",
  "..",
  "examples",
  "notes-suite.yaml",
);
const NOW = new Date("2026-06-15T00:00:00Z");
const DAY = 86_400_000;

let report: Awaited<ReturnType<typeof runSuite>>;
beforeAll(async () => {
  report = await runSuite(await loadSuite(SUITE), {
    provider: new ScriptedProvider(notesAgent),
    trials: 1,
  });
});

async function seedProject(slug: string) {
  const db = await getDb();
  const [org] = await db
    .insert(organization)
    .values({ slug, name: slug })
    .returning();
  const [project] = await db
    .insert(projects)
    .values({ orgId: org!.id, slug: "p", name: "P" })
    .returning();
  return { db, orgId: org!.id, projectId: project!.id };
}

async function insertRunAt(projectId: string, createdAt: Date) {
  const db = await getDb();
  const row = toRunRow(projectId, UploadSchema.parse({ report }));
  const [inserted] = await db
    .insert(runs)
    .values({ ...row, createdAt })
    .returning({ id: runs.id });
  return inserted!.id;
}

describe("cleanupExpiredRuns", () => {
  it("deletes runs older than the plan's retention window and keeps newer ones", async () => {
    const { db, orgId, projectId } = await seedProject("retention-early");
    await giveActivePlan(db, orgId, "early_access", projectId); // 90-day retention
    const old = await insertRunAt(
      projectId,
      new Date(NOW.getTime() - 91 * DAY),
    );
    const recent = await insertRunAt(
      projectId,
      new Date(NOW.getTime() - 89 * DAY),
    );

    const result = await cleanupExpiredRuns(db, NOW);
    expect(result.runsDeleted).toBeGreaterThanOrEqual(1);

    const ids = (await db.select({ id: runs.id }).from(runs)).map((r) => r.id);
    expect(ids).not.toContain(old);
    expect(ids).toContain(recent);
  });

  it("never deletes anything for a project with no numeric retention (free plan, no subscription)", async () => {
    const { db, projectId } = await seedProject("retention-free");
    const ancient = await insertRunAt(
      projectId,
      new Date(NOW.getTime() - 10_000 * DAY),
    );

    await cleanupExpiredRuns(db, NOW);

    const ids = (await db.select({ id: runs.id }).from(runs)).map((r) => r.id);
    expect(ids).toContain(ancient);
  });

  it("honours the plan's current retention, not a shorter one the project used to have", async () => {
    const { db, orgId, projectId } = await seedProject("retention-upgrade");
    // 100 days ago would be expired under early_access's 90-day window, but not under team's 365.
    const run = await insertRunAt(
      projectId,
      new Date(NOW.getTime() - 100 * DAY),
    );
    await giveActivePlan(db, orgId, "team", projectId);

    await cleanupExpiredRuns(db, NOW);

    const ids = (await db.select({ id: runs.id }).from(runs)).map((r) => r.id);
    expect(ids).toContain(run);
  });

  it("reports how many projects and runs it touched", async () => {
    const { db, orgId, projectId } = await seedProject("retention-report");
    await giveActivePlan(db, orgId, "early_access", projectId);
    await insertRunAt(projectId, new Date(NOW.getTime() - 200 * DAY));
    await insertRunAt(projectId, new Date(NOW.getTime() - 200 * DAY));

    const result = await cleanupExpiredRuns(db, NOW);
    expect(result.projectsCleaned).toBeGreaterThanOrEqual(1);
    expect(result.runsDeleted).toBeGreaterThanOrEqual(2);
    expect(result.projectsChecked).toBeGreaterThanOrEqual(
      result.projectsCleaned,
    );
  });
});

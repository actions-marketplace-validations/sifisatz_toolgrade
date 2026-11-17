import { join } from "node:path";
import { loadSuite, runSuite, ScriptedProvider } from "toolgrade";
import type { RunReport } from "toolgrade/core";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { organization, projects, runs } from "@/db/schema";
import { toRunRow, UploadSchema } from "@/lib/ingest";
import {
  billableUnits,
  currentCalendarMonth,
  getUsage,
  getUsageStatus,
} from "@/lib/usage";
import { notesAgent } from "../../examples/scripted-agent";
import { giveActivePlan } from "./helpers";

const SUITE = join(
  import.meta.dirname,
  "..",
  "..",
  "examples",
  "notes-suite.yaml",
);

function trial(
  taskId: string,
  trial: number,
  overrides: Partial<RunReport["trials"][number]> = {},
): RunReport["trials"][number] {
  return {
    taskId,
    arm: "tools",
    trial,
    passed: true,
    assertions: [],
    skipped: [],
    usage: { inputTokens: 0, outputTokens: 0 },
    costUsd: 0,
    ...overrides,
  };
}

describe("billableUnits", () => {
  it("counts one unit per (task, trial) when every arm for it ran cleanly", () => {
    const report = {
      trials: [
        trial("a", 1, { arm: "tools" }),
        trial("a", 1, { arm: "baseline" }),
        trial("a", 2, { arm: "tools" }),
        trial("a", 2, { arm: "baseline" }),
        trial("b", 1, { arm: "tools" }), // no baseline arm at all for this task - still 1 unit
      ],
    } as unknown as RunReport;
    expect(billableUnits(report)).toBe(3);
  });

  it("excludes a (task, trial) when either of its arms errored", () => {
    const report = {
      trials: [
        trial("a", 1, { arm: "tools" }),
        trial("a", 1, { arm: "baseline", error: "timed out" }),
        trial("a", 2, { arm: "tools", error: "rate limited" }),
        trial("a", 2, { arm: "baseline" }),
        trial("b", 1, { arm: "tools" }),
      ],
    } as unknown as RunReport;
    expect(billableUnits(report)).toBe(1); // only b#1
  });

  it("matches taskCount * trialsPerTask when nothing errored", async () => {
    const report = await runSuite(await loadSuite(SUITE), {
      provider: new ScriptedProvider(notesAgent),
      trials: 2,
    });
    expect(report.trials.every((t) => !t.error)).toBe(true);
    expect(billableUnits(report)).toBe(
      report.tasks.length * report.trialsPerTask,
    );
  });
});

describe("currentCalendarMonth", () => {
  it("spans exactly the UTC month containing the given date", () => {
    const { since, until } = currentCalendarMonth(
      new Date("2026-02-15T12:00:00Z"),
    );
    expect(since.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(until.toISOString()).toBe("2026-02-28T23:59:59.999Z");
  });
});

describe("getUsage", () => {
  let projectId: string;

  beforeAll(async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organization)
      .values({ slug: "usage-test", name: "Usage Test" })
      .returning();
    const [project] = await db
      .insert(projects)
      .values({ orgId: org!.id, slug: "p", name: "P" })
      .returning();
    projectId = project!.id;

    const report = await runSuite(await loadSuite(SUITE), {
      provider: new ScriptedProvider(notesAgent),
      trials: 1,
    });
    const upload = UploadSchema.parse({ report, meta: {} });
    const row = toRunRow(projectId, upload);

    await db.insert(runs).values([
      { ...row, createdAt: new Date("2026-02-10T00:00:00Z") },
      { ...row, createdAt: new Date("2026-02-20T00:00:00Z") },
      { ...row, createdAt: new Date("2026-03-01T00:00:00Z") }, // outside the February window
    ]);
  });

  it("sums billable units for runs within the window, and ignores runs outside it", async () => {
    const db = await getDb();
    const { since, until } = currentCalendarMonth(
      new Date("2026-02-15T00:00:00Z"),
    );
    const total = await getUsage(db, projectId, since, until);
    const report = await runSuite(await loadSuite(SUITE), {
      provider: new ScriptedProvider(notesAgent),
      trials: 1,
    });
    expect(total).toBe(billableUnits(report) * 2);
  });

  it("is zero for a project with no runs in the window", async () => {
    const db = await getDb();
    const total = await getUsage(
      db,
      projectId,
      new Date("2020-01-01"),
      new Date("2020-01-31"),
    );
    expect(total).toBe(0);
  });
});

describe("getUsageStatus", () => {
  it("uses the free plan's zero limit and the calendar month when there is no subscription", async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organization)
      .values({ slug: "status-free", name: "Status Free" })
      .returning();
    const [project] = await db
      .insert(projects)
      .values({ orgId: org!.id, slug: "p", name: "P" })
      .returning();
    const status = await getUsageStatus(db, org!.id, project!.id);
    expect(status).toMatchObject({ used: 0, limit: 0 });
    expect(status.entitlements.plan.id).toBe("free");
  });

  it("uses the subscription's own billing period, not the calendar month, once one exists", async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organization)
      .values({ slug: "status-paid", name: "Status Paid" })
      .returning();
    const [project] = await db
      .insert(projects)
      .values({ orgId: org!.id, slug: "p", name: "P" })
      .returning();
    await giveActivePlan(db, org!.id, "early_access", project!.id);

    const report = await runSuite(await loadSuite(SUITE), {
      provider: new ScriptedProvider(notesAgent),
      trials: 1,
    });
    const row = toRunRow(project!.id, UploadSchema.parse({ report }));
    // Outside the current calendar month, but inside the fake subscription's huge period (see helpers.ts).
    await db
      .insert(runs)
      .values({ ...row, createdAt: new Date("2021-06-01T00:00:00Z") });

    const status = await getUsageStatus(db, org!.id, project!.id);
    expect(status.limit).toBe(1000);
    expect(status.used).toBe(billableUnits(report));
  });
});

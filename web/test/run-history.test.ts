import { join } from "node:path";
import { loadSuite, runSuite, ScriptedProvider } from "toolgrade";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { organization, projects, runs } from "@/db/schema";
import { toRunRow, UploadSchema } from "@/lib/ingest";
import {
  queryRunFilterOptions,
  queryRunsFiltered,
  type RunCursor,
} from "@/lib/run-history";
import { notesAgent } from "../../examples/scripted-agent";

const SUITE = join(
  import.meta.dirname,
  "..",
  "..",
  "examples",
  "notes-suite.yaml",
);

let report: Awaited<ReturnType<typeof runSuite>>;
beforeAll(async () => {
  report = await runSuite(await loadSuite(SUITE), {
    provider: new ScriptedProvider(notesAgent),
    trials: 1,
  });
});

async function seedRun(
  projectId: string,
  overrides: Partial<typeof runs.$inferInsert>,
) {
  const db = await getDb();
  const row = toRunRow(projectId, UploadSchema.parse({ report }));
  const [inserted] = await db
    .insert(runs)
    .values({ ...row, ...overrides })
    .returning();
  return inserted!;
}

describe("queryRunsFiltered / queryRunFilterOptions", () => {
  let projectId: string;

  beforeAll(async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organization)
      .values({ slug: "run-history", name: "Run History" })
      .returning();
    const [project] = await db
      .insert(projects)
      .values({ orgId: org!.id, slug: "p", name: "P" })
      .returning();
    projectId = project!.id;

    await seedRun(projectId, {
      suite: "suite-a",
      provider: "anthropic",
      branch: "main",
      commit: "aaaaaaa",
      gatePassed: true,
      createdAt: new Date("2026-01-01"),
    });
    await seedRun(projectId, {
      suite: "suite-a",
      provider: "anthropic",
      branch: "feat/x",
      commit: "bbbbbbb",
      gatePassed: false,
      createdAt: new Date("2026-01-02"),
    });
    await seedRun(projectId, {
      suite: "suite-b",
      provider: "openai",
      branch: "main",
      commit: "ccccccc",
      gatePassed: true,
      createdAt: new Date("2026-01-03"),
    });
  });

  it("returns every run for the project with no filters", async () => {
    const db = await getDb();
    const { rows, hasMore } = await queryRunsFiltered(db, projectId, {});
    expect(rows).toHaveLength(3);
    expect(hasMore).toBe(false);
  });

  it("filters by suite", async () => {
    const db = await getDb();
    const { rows } = await queryRunsFiltered(db, projectId, {
      suite: "suite-a",
    });
    expect(rows.map((r) => r.branch).sort()).toEqual(["feat/x", "main"]);
  });

  it("filters by provider", async () => {
    const db = await getDb();
    const { rows } = await queryRunsFiltered(db, projectId, {
      provider: "openai",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.commit).toBe("ccccccc");
  });

  it("filters by branch", async () => {
    const db = await getDb();
    const { rows } = await queryRunsFiltered(db, projectId, {
      branch: "feat/x",
    });
    expect(rows).toHaveLength(1);
  });

  it("filters by commit prefix", async () => {
    const db = await getDb();
    const { rows } = await queryRunsFiltered(db, projectId, { commit: "ccc" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.commit).toBe("ccccccc");
  });

  it("filters by gate status", async () => {
    const db = await getDb();
    expect(
      (await queryRunsFiltered(db, projectId, { gatePassed: false })).rows,
    ).toHaveLength(1);
    expect(
      (await queryRunsFiltered(db, projectId, { gatePassed: true })).rows,
    ).toHaveLength(2);
  });

  it("filters by date range", async () => {
    const db = await getDb();
    const { rows } = await queryRunsFiltered(db, projectId, {
      since: new Date("2026-01-02"),
      until: new Date("2026-01-02T23:59:59Z"),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.commit).toBe("bbbbbbb");
  });

  it("combines multiple filters", async () => {
    const db = await getDb();
    const { rows } = await queryRunsFiltered(db, projectId, {
      suite: "suite-a",
      gatePassed: false,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.commit).toBe("bbbbbbb");
  });

  it("paginates with a cursor, newest first, never duplicating or skipping a row", async () => {
    const db = await getDb();
    const page1 = await queryRunsFiltered(db, projectId, {}, undefined, 2);
    expect(page1.rows).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeDefined();

    const page2 = await queryRunsFiltered(
      db,
      projectId,
      {},
      page1.nextCursor as RunCursor,
      2,
    );
    expect(page2.rows).toHaveLength(1);
    expect(page2.hasMore).toBe(false);

    const seenCommits = [...page1.rows, ...page2.rows].map((r) => r.commit);
    expect(seenCommits).toEqual(["ccccccc", "bbbbbbb", "aaaaaaa"]);
  });

  it("lists the distinct filter values actually seen for this project", async () => {
    const db = await getDb();
    const options = await queryRunFilterOptions(db, projectId);
    expect(options.suites.sort()).toEqual(["suite-a", "suite-b"]);
    expect(options.providers.sort()).toEqual(["anthropic", "openai"]);
    expect(options.branches.sort()).toEqual(["feat/x", "main"]);
  });
});

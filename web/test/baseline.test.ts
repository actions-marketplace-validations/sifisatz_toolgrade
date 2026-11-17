import { join } from "node:path";
import { loadSuite, runSuite, ScriptedProvider } from "toolgrade";
import { beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/runs/latest/route";
import { POST } from "@/app/api/v1/runs/route";
import { getDb } from "@/db/client";
import { apiKeys, organization, projects } from "@/db/schema";
import { generateApiKey } from "@/lib/api-keys";
import { notesAgent } from "../../examples/scripted-agent";
import { giveActivePlan } from "./helpers";

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

describe("GET /api/v1/runs/latest", () => {
  let key: string;
  let otherKey: string;

  beforeAll(async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organization)
      .values({ slug: "bt", name: "Baseline Test" })
      .returning();
    const [project] = await db
      .insert(projects)
      .values({ orgId: org!.id, slug: "p", name: "P" })
      .returning();
    const [otherProject] = await db
      .insert(projects)
      .values({ orgId: org!.id, slug: "other", name: "Other" })
      .returning();
    await giveActivePlan(db, org!.id, "team", project!.id);
    const live = generateApiKey();
    const other = generateApiKey();
    await db.insert(apiKeys).values([
      {
        projectId: project!.id,
        name: "ci",
        prefix: live.prefix,
        hash: live.hash,
      },
      {
        projectId: otherProject!.id,
        name: "ci",
        prefix: other.prefix,
        hash: other.hash,
      },
    ]);
    key = live.key;
    otherKey = other.key;

    const post = async (body: unknown, token: string) => {
      const res = await POST(
        new Request("http://localhost:3000/api/v1/runs", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }),
      );
      if (res.status !== 201)
        throw new Error(
          `seed upload failed: ${res.status} ${await res.text()}`,
        );
    };
    // Two runs on main, one on a feature branch, so "latest" and branch filtering are both exercised.
    await post({ report, meta: { branch: "main", commit: "aaaaaaa" } }, key);
    await post({ report, meta: { branch: "feat/x", commit: "bbbbbbb" } }, key);
    await post({ report, meta: { branch: "main", commit: "ccccccc" } }, key);
  });

  const get = (qs: string, token?: string) =>
    GET(
      new Request(`http://localhost:3000/api/v1/runs/latest${qs}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      }),
    );

  it("returns the most recent run for this project's key", async () => {
    const res = await get(`?suite=${report.suite}`, key);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      report: { startedAt: string };
    };
    expect(body.report.startedAt).toBe(report.startedAt);
  });

  it("filters by branch", async () => {
    const res = await get(`?suite=${report.suite}&branch=feat/x`, key);
    expect(res.status).toBe(200);
  });

  it("404s when no run matches", async () => {
    const res = await get(`?suite=${report.suite}&branch=does-not-exist`, key);
    expect(res.status).toBe(404);
  });

  it("never returns another project's runs", async () => {
    const res = await get(`?suite=${report.suite}`, otherKey);
    expect(res.status).toBe(404);
  });

  it("rejects missing or unknown keys", async () => {
    expect((await get(`?suite=${report.suite}`)).status).toBe(401);
    expect(
      (await get(`?suite=${report.suite}`, generateApiKey().key)).status,
    ).toBe(401);
  });
});

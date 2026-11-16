import { join } from "node:path";
import { loadSuite, runSuite, ScriptedProvider } from "toolgrade";
import { beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/v1/runs/route";
import { getDb } from "@/db/client";
import { apiKeys, orgs, projects, runs } from "@/db/schema";
import { bearerToken, generateApiKey, hashApiKey } from "@/lib/api-keys";
import { toRunRow, UploadSchema } from "@/lib/ingest";
import { notesAgent } from "../../examples/scripted-agent";

const SUITE = join(
  import.meta.dirname,
  "..",
  "..",
  "examples",
  "notes-suite.yaml",
);

// A real report produced by the engine against the real example server: the contract test.
let report: Awaited<ReturnType<typeof runSuite>>;
beforeAll(async () => {
  report = await runSuite(await loadSuite(SUITE), {
    provider: new ScriptedProvider(notesAgent),
    trials: 1,
  });
});

describe("api keys", () => {
  it("generates prefixed random keys and stores only a hash", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).toMatch(/^tg_[A-Za-z0-9_-]{43}$/);
    expect(a.key).not.toBe(b.key);
    expect(a.hash).toBe(hashApiKey(a.key));
    expect(a.hash).not.toContain(a.key);
    expect(a.prefix).toBe(a.key.slice(0, 10));
  });

  it("only accepts Bearer tokens in toolgrade format", () => {
    expect(bearerToken("Bearer tg_abc")).toBe("tg_abc");
    expect(bearerToken("bearer tg_abc")).toBe("tg_abc");
    expect(bearerToken("Bearer sk-ant-123")).toBeUndefined();
    expect(bearerToken(null)).toBeUndefined();
  });
});

describe("ingest schema (engine <-> platform contract)", () => {
  it("accepts a real engine report and indexes its headline numbers", () => {
    const upload = UploadSchema.parse({
      report,
      meta: { branch: "main", commit: "abc123" },
    });
    const row = toRunRow("p1", upload);
    expect(row.passRate).toBe(report.overall.tools.rate.rate);
    expect(row.lift).toBe(report.overall.lift?.delta);
    expect(row.gatePassed).toBe(report.gate.passed);
    expect(row.taskCount).toBe(6);
    expect(row.branch).toBe("main");
  });

  it("rejects something that is not a v1 report", () => {
    expect(
      UploadSchema.safeParse({ report: { ...report, version: 2 } }).success,
    ).toBe(false);
    expect(UploadSchema.safeParse({ report: { hello: "world" } }).success).toBe(
      false,
    );
  });
});

describe("POST /api/v1/runs", () => {
  let key: string;
  let revoked: string;
  let projectId: string;

  beforeAll(async () => {
    const db = await getDb();
    const [org] = await db
      .insert(orgs)
      .values({ slug: "t", name: "Test" })
      .returning();
    const [project] = await db
      .insert(projects)
      .values({ orgId: org!.id, slug: "p", name: "P" })
      .returning();
    projectId = project!.id;
    const live = generateApiKey();
    const dead = generateApiKey();
    await db.insert(apiKeys).values([
      { projectId, name: "ci", prefix: live.prefix, hash: live.hash },
      {
        projectId,
        name: "old",
        prefix: dead.prefix,
        hash: dead.hash,
        revokedAt: new Date(),
      },
    ]);
    key = live.key;
    revoked = dead.key;
  });

  const post = (body: unknown, token?: string) =>
    POST(
      new Request("http://localhost:3000/api/v1/runs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );

  it("stores a valid upload and returns the run URL", async () => {
    const res = await post(
      {
        report,
        meta: { branch: "feat/x", commit: "deadbeef", commitMessage: "Try it" },
      },
      key,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; url: string };
    expect(body.url).toBe(`http://localhost:3000/app/t/p/runs/${body.id}`);
    const db = await getDb();
    const stored = await db.select().from(runs);
    expect(stored.find((r) => r.id === body.id)).toMatchObject({
      projectId,
      branch: "feat/x",
      commitMessage: "Try it",
      passRate: report.overall.tools.rate.rate,
    });
    const used = (await db.select().from(apiKeys)).find((k) => k.name === "ci");
    expect(used!.lastUsedAt).not.toBeNull();
  });

  it("rejects missing, unknown and revoked keys", async () => {
    expect((await post({ report })).status).toBe(401);
    expect((await post({ report }, generateApiKey().key)).status).toBe(401);
    expect((await post({ report }, revoked)).status).toBe(401);
  });

  it("rejects malformed bodies with useful errors", async () => {
    expect((await post("{not json", key)).status).toBe(400);
    const res = await post({ report: { version: 1 } }, key);
    expect(res.status).toBe(422);
    expect(
      ((await res.json()) as { issues: unknown[] }).issues.length,
    ).toBeGreaterThan(0);
  });
});

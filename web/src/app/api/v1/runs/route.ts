import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { apiKeys, organization, projects, runs } from "@/db/schema";
import { recordEvent } from "@/lib/analytics";
import { bearerToken, hashApiKey } from "@/lib/api-keys";
import { hasNul, MAX_UPLOAD_BYTES, toRunRow, UploadSchema } from "@/lib/ingest";
import { logError, logInfo, logWarn, newRequestId } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { getUsageStatus } from "@/lib/usage";

const INGEST_RATE_LIMIT = { windowSeconds: 60, max: 30 };

const json = (body: unknown, status = 200) => Response.json(body, { status });
const tooLarge = () =>
  json({ error: `report exceeds ${MAX_UPLOAD_BYTES} bytes` }, 413);

/** Reads at most `limit` bytes of the body; null once the stream goes past it. */
async function readCapped(
  request: Request,
  limit: number,
): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** Ingest a run report from the CLI: `toolgrade run --upload <origin>` with TOOLGRADE_API_KEY. */
export async function POST(request: Request) {
  const requestId = newRequestId();
  const startedAt = Date.now();
  const category = "ingest";

  const token = bearerToken(request.headers.get("authorization"));
  if (!token) {
    logWarn("ingest rejected: missing or malformed bearer token", {
      requestId,
      category,
      durationMs: Date.now() - startedAt,
    });
    return json(
      { error: "missing or malformed API key (Authorization: Bearer tg_...)" },
      401,
    );
  }

  // Authenticate before touching the body, so unauthenticated callers cannot make us buffer it.
  const db = await getDb();
  const [key] = await db
    .select({
      id: apiKeys.id,
      projectId: apiKeys.projectId,
      orgId: projects.orgId,
      projectSlug: projects.slug,
      orgSlug: organization.slug,
    })
    .from(apiKeys)
    .innerJoin(projects, eq(apiKeys.projectId, projects.id))
    .innerJoin(organization, eq(projects.orgId, organization.id))
    .where(and(eq(apiKeys.hash, hashApiKey(token)), isNull(apiKeys.revokedAt)))
    .limit(1);
  if (!key) {
    logWarn("ingest rejected: invalid or revoked API key", {
      requestId,
      category,
      durationMs: Date.now() - startedAt,
    });
    return json({ error: "invalid or revoked API key" }, 401);
  }

  const withinRate = await checkRateLimit(
    db,
    `ingest:${key.id}`,
    INGEST_RATE_LIMIT.windowSeconds,
    INGEST_RATE_LIMIT.max,
  );
  if (!withinRate) {
    logWarn("ingest rejected: rate limited", {
      requestId,
      category,
      orgId: key.orgId,
      projectId: key.projectId,
      durationMs: Date.now() - startedAt,
    });
    return json(
      {
        error: `too many uploads for this API key - at most ${INGEST_RATE_LIMIT.max} per ${INGEST_RATE_LIMIT.windowSeconds}s`,
      },
      429,
    );
  }

  // Checked before reading the body: an over-limit upload shouldn't make us buffer it either.
  // Does not silently drop the report - the CLI surfaces this 402 and its message directly.
  const { used, limit } = await getUsageStatus(db, key.orgId, key.projectId);
  if (used >= limit) {
    logWarn("ingest rejected: usage limit reached", {
      requestId,
      category,
      orgId: key.orgId,
      projectId: key.projectId,
      used,
      limit,
      durationMs: Date.now() - startedAt,
    });
    const billingUrl = new URL(
      `/app/${key.orgSlug}/${key.projectSlug}/settings`,
      request.url,
    ).toString();
    return json(
      {
        error:
          limit === 0
            ? "this project's plan has no hosted evaluation allowance - upgrade to upload reports"
            : `this project has used its ${limit} evaluation units for this period`,
        usage: { used, limit },
        upgradeUrl: billingUrl,
      },
      402,
    );
  }

  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES)
    return tooLarge();
  const raw = await readCapped(request, MAX_UPLOAD_BYTES);
  if (raw === null) return tooLarge();
  if (hasNul(raw)) {
    logWarn("ingest rejected: NUL bytes in body", {
      requestId,
      category,
      orgId: key.orgId,
      projectId: key.projectId,
    });
    return json(
      { error: "report contains NUL characters, which cannot be stored" },
      422,
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    logWarn("ingest rejected: body is not valid JSON", {
      requestId,
      category,
      orgId: key.orgId,
      projectId: key.projectId,
    });
    return json({ error: "body is not valid JSON" }, 400);
  }
  const parsed = UploadSchema.safeParse(body);
  if (!parsed.success) {
    logWarn("ingest rejected: schema validation failed", {
      requestId,
      category,
      orgId: key.orgId,
      projectId: key.projectId,
      issueCount: parsed.error.issues.length,
    });
    return json(
      {
        error: "not a toolgrade v1 run report",
        issues: parsed.error.issues.slice(0, 10),
      },
      422,
    );
  }

  let runId: string;
  try {
    const [run] = await db
      .insert(runs)
      .values(toRunRow(key.projectId, parsed.data))
      .returning({ id: runs.id });
    runId = run!.id;
  } catch (err) {
    logError("ingest failed: run insert failed", {
      requestId,
      category,
      orgId: key.orgId,
      projectId: key.projectId,
      error: err instanceof Error ? err.message : String(err),
    });
    return json({ error: "report could not be stored" }, 422);
  }
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id));
  await recordEvent(db, {
    name: "run_ingested",
    organizationId: key.orgId,
    projectId: key.projectId,
    properties: {
      gatePassed: parsed.data.report.gate.passed,
      taskCount: parsed.data.report.tasks.length,
    },
  });

  logInfo("ingest succeeded", {
    requestId,
    category,
    orgId: key.orgId,
    projectId: key.projectId,
    runId,
    durationMs: Date.now() - startedAt,
  });

  const url = new URL(
    `/app/${key.orgSlug}/${key.projectSlug}/runs/${runId}`,
    request.url,
  ).toString();
  return json({ id: runId, url }, 201);
}

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { apiKeys, orgs, projects, runs } from "@/db/schema";
import { bearerToken, hashApiKey } from "@/lib/api-keys";
import { hasNul, MAX_UPLOAD_BYTES, toRunRow, UploadSchema } from "@/lib/ingest";

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
  const token = bearerToken(request.headers.get("authorization"));
  if (!token)
    return json(
      { error: "missing or malformed API key (Authorization: Bearer tg_...)" },
      401,
    );

  // Authenticate before touching the body, so unauthenticated callers cannot make us buffer it.
  const db = await getDb();
  const [key] = await db
    .select({
      id: apiKeys.id,
      projectId: apiKeys.projectId,
      projectSlug: projects.slug,
      orgSlug: orgs.slug,
    })
    .from(apiKeys)
    .innerJoin(projects, eq(apiKeys.projectId, projects.id))
    .innerJoin(orgs, eq(projects.orgId, orgs.id))
    .where(and(eq(apiKeys.hash, hashApiKey(token)), isNull(apiKeys.revokedAt)))
    .limit(1);
  if (!key) return json({ error: "invalid or revoked API key" }, 401);

  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES)
    return tooLarge();
  const raw = await readCapped(request, MAX_UPLOAD_BYTES);
  if (raw === null) return tooLarge();
  if (hasNul(raw))
    return json(
      { error: "report contains NUL characters, which cannot be stored" },
      422,
    );

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "body is not valid JSON" }, 400);
  }
  const parsed = UploadSchema.safeParse(body);
  if (!parsed.success)
    return json(
      {
        error: "not a toolgrade v1 run report",
        issues: parsed.error.issues.slice(0, 10),
      },
      422,
    );

  let runId: string;
  try {
    const [run] = await db
      .insert(runs)
      .values(toRunRow(key.projectId, parsed.data))
      .returning({ id: runs.id });
    runId = run!.id;
  } catch (err) {
    console.error(
      "run insert failed",
      err instanceof Error ? err.message : err,
    );
    return json({ error: "report could not be stored" }, 422);
  }
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id));

  const url = new URL(
    `/app/${key.orgSlug}/${key.projectSlug}/runs/${runId}`,
    request.url,
  ).toString();
  return json({ id: runId, url }, 201);
}

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { apiKeys, orgs, projects, runs } from "@/db/schema";
import { bearerToken, hashApiKey } from "@/lib/api-keys";
import { MAX_UPLOAD_BYTES, toRunRow, UploadSchema } from "@/lib/ingest";

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Ingest a run report from the CLI: `toolgrade run --upload <origin>` with TOOLGRADE_API_KEY. */
export async function POST(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token)
    return json(
      { error: "missing or malformed API key (Authorization: Bearer tg_...)" },
      401,
    );

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES)
    return json({ error: `report exceeds ${MAX_UPLOAD_BYTES} bytes` }, 413);
  const raw = await request.text();
  if (raw.length > MAX_UPLOAD_BYTES)
    return json({ error: `report exceeds ${MAX_UPLOAD_BYTES} bytes` }, 413);

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

  const [run] = await db
    .insert(runs)
    .values(toRunRow(key.projectId, parsed.data))
    .returning({ id: runs.id });
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id));

  const url = new URL(
    `/app/${key.orgSlug}/${key.projectSlug}/runs/${run!.id}`,
    request.url,
  ).toString();
  return json({ id: run!.id, url }, 201);
}

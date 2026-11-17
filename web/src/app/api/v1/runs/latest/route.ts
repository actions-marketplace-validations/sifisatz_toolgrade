import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { runs } from "@/db/schema";
import {
  authenticateApiKey,
  bearerToken,
  markApiKeyUsed,
} from "@/lib/api-keys";
import { logWarn, newRequestId } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

const json = (body: unknown, status = 200) => Response.json(body, { status });
const BASELINE_RATE_LIMIT = { windowSeconds: 60, max: 60 };

/**
 * The most recent matching run for this project's API key, for `toolgrade run --baseline <url>`
 * to compare a new run against in CI without the caller having to manage its own build artifacts.
 */
export async function GET(request: Request) {
  const requestId = newRequestId();
  const category = "baseline";

  const token = bearerToken(request.headers.get("authorization"));
  if (!token) {
    logWarn("baseline rejected: missing or malformed bearer token", {
      requestId,
      category,
    });
    return json(
      { error: "missing or malformed API key (Authorization: Bearer tg_...)" },
      401,
    );
  }

  const db = await getDb();
  const key = await authenticateApiKey(db, token);
  if (!key) {
    logWarn("baseline rejected: invalid or revoked API key", {
      requestId,
      category,
    });
    return json({ error: "invalid or revoked API key" }, 401);
  }

  const withinRate = await checkRateLimit(
    db,
    `baseline:${key.id}`,
    BASELINE_RATE_LIMIT.windowSeconds,
    BASELINE_RATE_LIMIT.max,
  );
  if (!withinRate) {
    logWarn("baseline rejected: rate limited", {
      requestId,
      category,
      projectId: key.projectId,
    });
    return json(
      {
        error: `too many requests for this API key - at most ${BASELINE_RATE_LIMIT.max} per ${BASELINE_RATE_LIMIT.windowSeconds}s`,
      },
      429,
    );
  }

  const { searchParams } = new URL(request.url);
  const suite = searchParams.get("suite");
  const branch = searchParams.get("branch");

  const conditions = [eq(runs.projectId, key.projectId)];
  if (suite) conditions.push(eq(runs.suite, suite));
  if (branch) conditions.push(eq(runs.branch, branch));

  const [run] = await db
    .select({ id: runs.id, report: runs.report })
    .from(runs)
    .where(and(...conditions))
    .orderBy(desc(runs.createdAt))
    .limit(1);

  await markApiKeyUsed(db, key.id);

  if (!run) return json({ error: "no matching run found" }, 404);
  return json({ id: run.id, report: run.report });
}

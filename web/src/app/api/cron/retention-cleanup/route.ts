import { getDb } from "@/db/client";
import { logError, logInfo, logWarn, newRequestId } from "@/lib/logger";
import { cleanupExpiredRuns } from "@/lib/retention";

const json = (body: unknown, status = 200) => Response.json(body, { status });

/**
 * Vercel Cron Jobs (see vercel.json) sends `Authorization: Bearer $CRON_SECRET` automatically
 * when that env var is set - this is that convention, not a custom scheme. CRON_SECRET unset
 * must reject every request: an empty/undefined secret would otherwise make `Bearer undefined`
 * (what a caller sends when it has no value either) a valid match.
 */
export async function GET(request: Request) {
  const requestId = newRequestId();
  const startedAt = Date.now();
  const category = "retention-cleanup";

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logError("retention cleanup rejected: CRON_SECRET is not set", {
      requestId,
      category,
    });
    return json({ error: "CRON_SECRET is not set" }, 500);
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    logWarn("retention cleanup rejected: unauthorized", {
      requestId,
      category,
    });
    return json({ error: "unauthorized" }, 401);
  }

  const db = await getDb();
  try {
    const result = await cleanupExpiredRuns(db);
    logInfo("retention cleanup completed", {
      requestId,
      category,
      ...result,
      durationMs: Date.now() - startedAt,
    });
    return json(result);
  } catch (err) {
    logError("retention cleanup failed", {
      requestId,
      category,
      error: err instanceof Error ? err.message : String(err),
    });
    return json({ error: "retention cleanup failed" }, 500);
  }
}

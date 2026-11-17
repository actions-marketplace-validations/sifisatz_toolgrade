import { getDb } from "@/db/client";
import { cleanupExpiredRuns } from "@/lib/retention";

const json = (body: unknown, status = 200) => Response.json(body, { status });

/**
 * Vercel Cron Jobs (see vercel.json) sends `Authorization: Bearer $CRON_SECRET` automatically
 * when that env var is set - this is that convention, not a custom scheme. CRON_SECRET unset
 * must reject every request: an empty/undefined secret would otherwise make `Bearer undefined`
 * (what a caller sends when it has no value either) a valid match.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: "CRON_SECRET is not set" }, 500);
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const db = await getDb();
  const result = await cleanupExpiredRuns(db);
  console.log("retention cleanup", result);
  return json(result);
}

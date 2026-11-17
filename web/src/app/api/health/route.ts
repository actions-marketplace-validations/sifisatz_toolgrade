import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { logError } from "@/lib/logger";

const json = (body: unknown, status = 200) => Response.json(body, { status });

/**
 * For uptime checks and Vercel's own health probing, not for humans - no stack traces, no
 * connection strings, nothing about which database driver is in use. Just: is the app up, and
 * can it reach its own database.
 */
export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return json({ status: "ok", database: "ok" });
  } catch (err) {
    logError("health check failed: database unreachable", {
      category: "health",
      error: err instanceof Error ? err.message : String(err),
    });
    return json({ status: "degraded", database: "error" }, 503);
  }
}

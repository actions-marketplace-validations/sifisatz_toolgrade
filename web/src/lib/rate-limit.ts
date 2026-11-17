import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { rateLimit } from "@/db/schema";

/**
 * A fixed-window counter sharing the rate_limit table with Better Auth's own "database" storage
 * (see lib/auth.ts) - different key namespace (callers should prefix, e.g. "ingest:<id>"), same
 * table, no second piece of infrastructure. The window resets the first time it's checked after
 * expiring, rather than sliding continuously; that is a deliberate simplification, not an
 * oversight - exact precision does not matter for abuse prevention at this scale.
 *
 * The increment-or-reset is one atomic upsert (via a unique constraint on `key`), so two
 * concurrent requests for the same key cannot both observe "window expired" and both reset the
 * counter to 1, undercounting a burst.
 *
 * @returns true if this request is allowed, false if `key` is over `max` within `windowSeconds`.
 */
export async function checkRateLimit(
  db: Db,
  key: string,
  windowSeconds: number,
  max: number,
): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const [row] = await db
    .insert(rateLimit)
    .values({ key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${rateLimit.lastRequest} < ${windowStart} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${rateLimit.lastRequest} < ${windowStart} then ${now} else ${rateLimit.lastRequest} end`,
      },
    })
    .returning({ count: rateLimit.count });
  return (row?.count ?? 0) <= max;
}

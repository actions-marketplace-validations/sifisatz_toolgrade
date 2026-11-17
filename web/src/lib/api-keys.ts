import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { apiKeys } from "@/db/schema";

const PREFIX = "tg_";

/** A new key: `tg_` + 32 random bytes in base64url. Only the hash is persisted. */
export function generateApiKey(): {
  key: string;
  prefix: string;
  hash: string;
} {
  const key = `${PREFIX}${randomBytes(32).toString("base64url")}`;
  return { key, prefix: key.slice(0, 10), hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function bearerToken(header: string | null): string | undefined {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? "");
  return m?.[1]?.startsWith(PREFIX) ? m[1] : undefined;
}

/** The project a valid, non-revoked API key grants access to - shared by every /api/v1/runs route. */
export async function authenticateApiKey(
  db: Db,
  token: string,
): Promise<{ id: string; projectId: string } | undefined> {
  const [key] = await db
    .select({ id: apiKeys.id, projectId: apiKeys.projectId })
    .from(apiKeys)
    .where(and(eq(apiKeys.hash, hashApiKey(token)), isNull(apiKeys.revokedAt)))
    .limit(1);
  return key;
}

export async function markApiKeyUsed(db: Db, id: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, id));
}

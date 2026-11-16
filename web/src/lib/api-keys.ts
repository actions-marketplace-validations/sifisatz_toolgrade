import { createHash, randomBytes } from "node:crypto";

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

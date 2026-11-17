// Deliberately no `import "server-only"` here: scripts/seed.ts (run via plain tsx, outside
// Next's bundler, through lib/auth.ts) needs to load this module, and "server-only" throws
// unconditionally outside that bundler - it isn't a Next-aware guard once you're not inside Next.
// This module has no secrets of its own to protect (redact() exists specifically so it's safe to
// call from anywhere), so the guard was precautionary rather than load-bearing.

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Structured fields for a log line. Callers must pass sensitive values as a field (never
 * interpolated into `message`) for redact() to catch them - "Bearer <token>" baked into a message
 * string bypasses this entirely, so it never belongs there.
 */
export interface LogFields {
  requestId?: string;
  orgId?: string;
  projectId?: string;
  runId?: string;
  category?: string;
  durationMs?: number;
  [key: string]: unknown;
}

// Matched by exact field name (case-insensitive), not substring - "apiKeyId" is a safe identifier
// and must not be caught by a loose match on "key".
const SENSITIVE_FIELDS = new Set([
  "password",
  "token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "clientsecret",
  "hash",
]);

function redact(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = SENSITIVE_FIELDS.has(k.toLowerCase()) ? "[redacted]" : v;
  }
  return out;
}

function emit(level: LogLevel, message: string, fields: LogFields): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...redact(fields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logDebug = (message: string, fields: LogFields = {}) =>
  emit("debug", message, fields);
export const logInfo = (message: string, fields: LogFields = {}) =>
  emit("info", message, fields);
export const logWarn = (message: string, fields: LogFields = {}) =>
  emit("warn", message, fields);
export const logError = (message: string, fields: LogFields = {}) =>
  emit("error", message, fields);

/** A per-request id for correlating every log line from one request - not a security token, just a correlation id. */
export function newRequestId(): string {
  return crypto.randomUUID();
}

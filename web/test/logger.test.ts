import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  logDebug,
  logError,
  logInfo,
  logWarn,
  newRequestId,
} from "@/lib/logger";

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

function lastLine(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const call = spy.mock.calls.at(-1);
  return JSON.parse(call?.[0] as string);
}

describe("structured logger", () => {
  it("emits info/debug to console.log, warn to console.warn, error to console.error", () => {
    logInfo("info msg");
    logDebug("debug msg");
    expect(logSpy).toHaveBeenCalledTimes(2);
    logWarn("warn msg");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    logError("error msg");
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("emits a single JSON line with timestamp, level, message and the given fields", () => {
    logInfo("uploaded a run", {
      requestId: "r1",
      orgId: "o1",
      projectId: "p1",
      runId: "run1",
      durationMs: 42,
    });
    const entry = lastLine(logSpy);
    expect(entry).toMatchObject({
      level: "info",
      message: "uploaded a run",
      requestId: "r1",
      orgId: "o1",
      projectId: "p1",
      runId: "run1",
      durationMs: 42,
    });
    expect(typeof entry.timestamp).toBe("string");
    expect(new Date(entry.timestamp as string).toString()).not.toBe(
      "Invalid Date",
    );
  });

  it("redacts known-sensitive field names regardless of case", () => {
    logInfo("auth attempt", {
      password: "hunter2",
      API_KEY: "tg_abc",
      Authorization: "Bearer xyz",
      token: "t",
    });
    const entry = lastLine(logSpy);
    expect(entry.password).toBe("[redacted]");
    expect(entry.API_KEY).toBe("[redacted]");
    expect(entry.Authorization).toBe("[redacted]");
    expect(entry.token).toBe("[redacted]");
  });

  it("does not redact fields that merely contain a sensitive substring, only exact field names", () => {
    logInfo("key lookup", { apiKeyId: "abc-123" });
    const entry = lastLine(logSpy);
    expect(entry.apiKeyId).toBe("abc-123");
  });

  it("never throws on circular-safe values and keeps unrelated fields untouched", () => {
    logInfo("ok", { category: "ingest", nested: { a: 1 } });
    const entry = lastLine(logSpy);
    expect(entry.category).toBe("ingest");
    expect(entry.nested).toEqual({ a: 1 });
  });
});

describe("newRequestId", () => {
  it("returns a unique id each time", () => {
    const a = newRequestId();
    const b = newRequestId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

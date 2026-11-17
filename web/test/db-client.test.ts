import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("db client", () => {
  it("refuses to fall back to PGlite in production without DATABASE_URL", async () => {
    delete process.env.DATABASE_URL;
    process.env.VERCEL_ENV = "production";
    const { dbHandle } = await import("@/db/client");
    expect(() => dbHandle()).toThrow(/DATABASE_URL/);
  });

  it("still allows PGlite outside production", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.VERCEL_ENV;
    process.env.PGLITE_DIR = "memory://";
    const { dbHandle } = await import("@/db/client");
    expect(() => dbHandle()).not.toThrow();
  });
});

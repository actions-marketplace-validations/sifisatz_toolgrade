import { describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows requests up to the max within the window", async () => {
    const db = await getDb();
    const key = `test:${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) {
      expect(await checkRateLimit(db, key, 60, 3)).toBe(true);
    }
  });

  it("rejects once the max is exceeded within the window", async () => {
    const db = await getDb();
    const key = `test:${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) await checkRateLimit(db, key, 60, 3);
    expect(await checkRateLimit(db, key, 60, 3)).toBe(false);
  });

  it("resets once the window has passed", async () => {
    const db = await getDb();
    const key = `test:${crypto.randomUUID()}`;
    const realNow = Date.now;
    try {
      vi.spyOn(Date, "now").mockReturnValue(1_000_000);
      for (let i = 0; i < 3; i++) await checkRateLimit(db, key, 60, 3);
      expect(await checkRateLimit(db, key, 60, 3)).toBe(false);

      vi.spyOn(Date, "now").mockReturnValue(1_000_000 + 61_000);
      expect(await checkRateLimit(db, key, 60, 3)).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });

  it("tracks independent keys independently", async () => {
    const db = await getDb();
    const a = `test:${crypto.randomUUID()}`;
    const b = `test:${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) await checkRateLimit(db, a, 60, 3);
    expect(await checkRateLimit(db, a, 60, 3)).toBe(false);
    expect(await checkRateLimit(db, b, 60, 3)).toBe(true);
  });
});

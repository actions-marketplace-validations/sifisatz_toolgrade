import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("reports ok with a reachable database, and nothing sensitive", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ status: "ok", database: "ok" });
    const text = JSON.stringify(body).toLowerCase();
    expect(text).not.toMatch(/postgres|pglite|password|secret|connection/);
  });
});

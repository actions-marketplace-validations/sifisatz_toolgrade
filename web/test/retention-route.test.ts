import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron/retention-cleanup/route";

const ORIGINAL = process.env.CRON_SECRET;

beforeEach(() => {
  delete process.env.CRON_SECRET;
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIGINAL;
});

function get(authorization?: string) {
  return GET(
    new Request("http://localhost:3000/api/cron/retention-cleanup", {
      headers: authorization ? { authorization } : {},
    }),
  );
}

describe("GET /api/cron/retention-cleanup", () => {
  it("refuses every request when CRON_SECRET is not set, even a guessed 'Bearer undefined'", async () => {
    expect((await get()).status).toBe(500);
    expect((await get("Bearer undefined")).status).toBe(500);
  });

  it("rejects a wrong or missing secret once one is configured", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await get()).status).toBe(401);
    expect((await get("Bearer wrong")).status).toBe(401);
  });

  it("runs the cleanup when the secret matches", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await get("Bearer s3cret");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      projectsChecked: number;
      projectsCleaned: number;
      runsDeleted: number;
    };
    expect(body).toMatchObject({
      projectsChecked: expect.any(Number),
      projectsCleaned: expect.any(Number),
      runsDeleted: expect.any(Number),
    });
  });
});

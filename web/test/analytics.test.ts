import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { organization, productEvents } from "@/db/schema";
import { recordEvent } from "@/lib/analytics";

describe("recordEvent", () => {
  let orgId: string;

  beforeAll(async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organization)
      .values({ slug: "analytics-test", name: "Analytics Test" })
      .returning();
    orgId = org!.id;
  });

  it("stores the event with its properties", async () => {
    const db = await getDb();
    await recordEvent(db, {
      name: "project_created",
      organizationId: orgId,
      properties: { plan: "early_access" },
    });
    const [row] = await db
      .select()
      .from(productEvents)
      .where(eq(productEvents.organizationId, orgId));
    expect(row).toMatchObject({
      name: "project_created",
      organizationId: orgId,
      properties: { plan: "early_access" },
    });
  });

  it("defaults properties to an empty object when omitted", async () => {
    const db = await getDb();
    await recordEvent(db, { name: "api_key_created", organizationId: orgId });
    const rows = await db
      .select()
      .from(productEvents)
      .where(eq(productEvents.organizationId, orgId));
    const row = rows.find((r) => r.name === "api_key_created");
    expect(row?.properties).toEqual({});
  });

  it("never throws, even when the event references an organization that does not exist", async () => {
    const db = await getDb();
    await expect(
      recordEvent(db, {
        name: "org_created",
        organizationId: "00000000-0000-0000-0000-000000000000",
      }),
    ).resolves.toBeUndefined();
  });
});

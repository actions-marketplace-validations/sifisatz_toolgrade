import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { organization, projects, subscriptions } from "@/db/schema";
import { getEntitlements } from "@/lib/entitlements";
import { PLANS } from "@/lib/plans";

describe("getEntitlements", () => {
  let orgId: string;
  let projectId: string;
  let otherProjectId: string;

  beforeAll(async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organization)
      .values({ slug: "ent-test", name: "Entitlements Test" })
      .returning();
    orgId = org!.id;
    const [project] = await db
      .insert(projects)
      .values({ orgId, slug: "p1", name: "P1" })
      .returning();
    projectId = project!.id;
    const [otherProject] = await db
      .insert(projects)
      .values({ orgId, slug: "p2", name: "P2" })
      .returning();
    otherProjectId = otherProject!.id;
  });

  it("defaults to free with no subscription row", async () => {
    const db = await getDb();
    const result = await getEntitlements(db, orgId, projectId);
    expect(result).toEqual({ plan: PLANS.free });
  });

  it("grants a project-level plan only to its own project", async () => {
    const db = await getDb();
    await db.insert(subscriptions).values({
      organizationId: orgId,
      projectId,
      plan: "early_access",
      status: "active",
    });

    const mine = await getEntitlements(db, orgId, projectId);
    expect(mine.plan).toBe(PLANS.early_access);
    expect(mine.status).toBe("active");

    const other = await getEntitlements(db, orgId, otherProjectId);
    expect(other.plan).toBe(PLANS.free);
  });

  it("an org-level (Growth) subscription covers every project and wins over a project-level one", async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organization)
      .values({ slug: "ent-growth", name: "Growth Org" })
      .returning();
    const [proj] = await db
      .insert(projects)
      .values({ orgId: org!.id, slug: "p", name: "P" })
      .returning();
    await db.insert(subscriptions).values([
      {
        organizationId: org!.id,
        projectId: null,
        plan: "growth",
        status: "active",
      },
      {
        organizationId: org!.id,
        projectId: proj!.id,
        plan: "early_access",
        status: "active",
      },
    ]);

    const result = await getEntitlements(db, org!.id, proj!.id);
    expect(result.plan).toBe(PLANS.growth);
  });

  it("treats canceled and incomplete subscriptions as not entitled", async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organization)
      .values({ slug: "ent-canceled", name: "Canceled Org" })
      .returning();
    const [proj] = await db
      .insert(projects)
      .values({ orgId: org!.id, slug: "p", name: "P" })
      .returning();
    await db.insert(subscriptions).values({
      organizationId: org!.id,
      projectId: proj!.id,
      plan: "team",
      status: "canceled",
    });

    expect((await getEntitlements(db, org!.id, proj!.id)).plan).toBe(
      PLANS.free,
    );
  });

  it("still entitles a past_due subscription (grace period)", async () => {
    const db = await getDb();
    const [org] = await db
      .insert(organization)
      .values({ slug: "ent-pastdue", name: "Past Due Org" })
      .returning();
    const [proj] = await db
      .insert(projects)
      .values({ orgId: org!.id, slug: "p", name: "P" })
      .returning();
    await db.insert(subscriptions).values({
      organizationId: org!.id,
      projectId: proj!.id,
      plan: "team",
      status: "past_due",
    });

    expect((await getEntitlements(db, org!.id, proj!.id)).plan).toBe(
      PLANS.team,
    );
  });

  it("never lets one project's subscription leak into an unrelated project lookup with no projectId", async () => {
    const db = await getDb();
    const result = await getEntitlements(db, orgId);
    expect(result.plan).toBe(PLANS.free);
  });
});

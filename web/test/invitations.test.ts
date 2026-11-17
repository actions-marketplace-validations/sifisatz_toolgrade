import { describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { invitation, organization, user } from "@/db/schema";
import { queryPendingInvitations } from "@/lib/invitations";

async function makeOrg(slug: string) {
  const db = await getDb();
  const [org] = await db
    .insert(organization)
    .values({ slug, name: slug })
    .returning();
  return org!.id;
}

async function makeInviter(email: string) {
  const db = await getDb();
  const [u] = await db.insert(user).values({ name: email, email }).returning();
  return u!.id;
}

async function invite(
  organizationId: string,
  inviterId: string,
  overrides: Partial<typeof invitation.$inferInsert> = {},
) {
  const db = await getDb();
  await db.insert(invitation).values({
    organizationId,
    inviterId,
    email: "invitee@example.com",
    role: "member",
    status: "pending",
    expiresAt: new Date(Date.now() + 86_400_000),
    ...overrides,
  });
}

describe("queryPendingInvitations", () => {
  it("lists pending invitations for an org, oldest first", async () => {
    const orgId = await makeOrg("invites-order");
    const inviterId = await makeInviter("owner-a@example.com");
    await invite(orgId, inviterId, { email: "first@example.com" });
    await invite(orgId, inviterId, { email: "second@example.com" });

    const db = await getDb();
    const rows = await queryPendingInvitations(db, orgId);
    expect(rows.map((r) => r.email)).toEqual([
      "first@example.com",
      "second@example.com",
    ]);
  });

  it("excludes invitations that are not pending", async () => {
    const orgId = await makeOrg("invites-status");
    const inviterId = await makeInviter("owner-b@example.com");
    await invite(orgId, inviterId, {
      email: "accepted@example.com",
      status: "accepted",
    });
    await invite(orgId, inviterId, { email: "still-pending@example.com" });

    const db = await getDb();
    const rows = await queryPendingInvitations(db, orgId);
    expect(rows.map((r) => r.email)).toEqual(["still-pending@example.com"]);
  });

  it("excludes expired invitations", async () => {
    const orgId = await makeOrg("invites-expiry");
    const inviterId = await makeInviter("owner-c@example.com");
    await invite(orgId, inviterId, {
      email: "expired@example.com",
      expiresAt: new Date(Date.now() - 1000),
    });
    await invite(orgId, inviterId, { email: "fresh@example.com" });

    const db = await getDb();
    const rows = await queryPendingInvitations(db, orgId);
    expect(rows.map((r) => r.email)).toEqual(["fresh@example.com"]);
  });

  it("never returns another org's invitations", async () => {
    const orgA = await makeOrg("invites-a");
    const orgB = await makeOrg("invites-b");
    const inviterId = await makeInviter("owner-d@example.com");
    await invite(orgA, inviterId, { email: "a@example.com" });
    await invite(orgB, inviterId, { email: "b@example.com" });

    const db = await getDb();
    const rows = await queryPendingInvitations(db, orgA);
    expect(rows.map((r) => r.email)).toEqual(["a@example.com"]);
  });
});

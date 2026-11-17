import { describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { member, organization, user } from "@/db/schema";
import { soleOwnerOrgs } from "@/lib/auth";

async function makeUser(email: string) {
  const db = await getDb();
  const [u] = await db.insert(user).values({ name: email, email }).returning();
  return u!.id;
}

async function makeOrg(slug: string) {
  const db = await getDb();
  const [org] = await db
    .insert(organization)
    .values({ slug, name: slug })
    .returning();
  return org!.id;
}

async function addMember(
  organizationId: string,
  userId: string,
  role: "owner" | "admin" | "member",
) {
  const db = await getDb();
  await db.insert(member).values({ organizationId, userId, role });
}

describe("soleOwnerOrgs", () => {
  it("is empty for a user who owns nothing", async () => {
    const userId = await makeUser("nobody@example.com");
    expect(await soleOwnerOrgs(userId)).toEqual([]);
  });

  it("flags an org where this user is the only owner", async () => {
    const userId = await makeUser("solo-owner@example.com");
    const orgId = await makeOrg("solo-owner-org");
    await addMember(orgId, userId, "owner");
    expect(await soleOwnerOrgs(userId)).toEqual([orgId]);
  });

  it("does not flag an org that has another owner too", async () => {
    const userId = await makeUser("co-owner@example.com");
    const other = await makeUser("co-owner-2@example.com");
    const orgId = await makeOrg("co-owned-org");
    await addMember(orgId, userId, "owner");
    await addMember(orgId, other, "owner");
    expect(await soleOwnerOrgs(userId)).toEqual([]);
  });

  it("is not affected by non-owner members of the same org", async () => {
    const userId = await makeUser("solo-owner-2@example.com");
    const member2 = await makeUser("just-a-member@example.com");
    const orgId = await makeOrg("solo-owner-org-2");
    await addMember(orgId, userId, "owner");
    await addMember(orgId, member2, "member");
    expect(await soleOwnerOrgs(userId)).toEqual([orgId]);
  });

  it("does not flag an org where this user is only a member or admin, not an owner", async () => {
    const userId = await makeUser("admin-only@example.com");
    const orgId = await makeOrg("admin-only-org");
    await addMember(orgId, userId, "admin");
    expect(await soleOwnerOrgs(userId)).toEqual([]);
  });

  it("lists every org the user is the sole owner of, across multiple orgs", async () => {
    const userId = await makeUser("multi-owner@example.com");
    const orgA = await makeOrg("multi-owner-a");
    const orgB = await makeOrg("multi-owner-b");
    await addMember(orgA, userId, "owner");
    await addMember(orgB, userId, "owner");
    expect(await soleOwnerOrgs(userId)).toEqual(
      expect.arrayContaining([orgA, orgB]),
    );
  });
});

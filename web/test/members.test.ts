import { describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { member, organization, user } from "@/db/schema";
import { countOwners, queryOrgMembers } from "@/lib/members";

async function makeUser(email: string, name = email) {
  const db = await getDb();
  const [u] = await db.insert(user).values({ name, email }).returning();
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

describe("queryOrgMembers", () => {
  it("lists every member of an org with their user details, oldest first", async () => {
    const orgId = await makeOrg("members-order");
    const alice = await makeUser("alice@example.com", "Alice");
    const bob = await makeUser("bob@example.com", "Bob");
    await addMember(orgId, alice, "owner");
    await addMember(orgId, bob, "member");

    const db = await getDb();
    const members = await queryOrgMembers(db, orgId);
    expect(members.map((m) => m.email)).toEqual([
      "alice@example.com",
      "bob@example.com",
    ]);
    expect(members[0]).toMatchObject({ name: "Alice", role: "owner" });
    expect(members[1]).toMatchObject({ name: "Bob", role: "member" });
  });

  it("never returns another org's members", async () => {
    const orgA = await makeOrg("members-a");
    const orgB = await makeOrg("members-b");
    const alice = await makeUser("iso-alice@example.com");
    const bob = await makeUser("iso-bob@example.com");
    await addMember(orgA, alice, "owner");
    await addMember(orgB, bob, "owner");

    const db = await getDb();
    const members = await queryOrgMembers(db, orgA);
    expect(members).toHaveLength(1);
    expect(members[0]?.userId).toBe(alice);
  });
});

describe("countOwners", () => {
  it("counts only owners, not admins or members", () => {
    const members = [
      {
        id: "1",
        userId: "u1",
        name: "A",
        email: "a@x.com",
        role: "owner",
        createdAt: new Date(),
      },
      {
        id: "2",
        userId: "u2",
        name: "B",
        email: "b@x.com",
        role: "admin",
        createdAt: new Date(),
      },
      {
        id: "3",
        userId: "u3",
        name: "C",
        email: "c@x.com",
        role: "owner",
        createdAt: new Date(),
      },
      {
        id: "4",
        userId: "u4",
        name: "D",
        email: "d@x.com",
        role: "member",
        createdAt: new Date(),
      },
    ];
    expect(countOwners(members)).toBe(2);
  });

  it("is zero for an empty list", () => {
    expect(countOwners([])).toBe(0);
  });
});

import { asc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { member, user } from "@/db/schema";

export interface OrgMember {
  /** The member row's id - what updateOrgMemberRole/removeOrgMember take, not the user's id. */
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

/** Every member of an org, oldest first, with the user details the Members page needs to display. */
export async function queryOrgMembers(
  db: Db,
  organizationId: string,
): Promise<OrgMember[]> {
  const rows = await db
    .select({
      id: member.id,
      userId: member.userId,
      name: user.name,
      email: user.email,
      role: member.role,
      createdAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId))
    .orderBy(asc(member.createdAt));
  return rows;
}

/** How many owners this org currently has - removing or demoting its only owner must be refused (the organization plugin already does; this is for disabling that control in the UI before the user tries). */
export function countOwners(members: OrgMember[]): number {
  return members.filter((m) => m.role === "owner").length;
}

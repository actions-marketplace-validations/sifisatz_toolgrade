import { and, asc, eq, gt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { invitation } from "@/db/schema";

export interface PendingInvitation {
  id: string;
  email: string;
  role: string | null;
  createdAt: Date;
  expiresAt: Date;
}

/** Every not-yet-expired pending invitation for an org, oldest first - same ordering as queryOrgMembers. */
export async function queryPendingInvitations(
  db: Db,
  organizationId: string,
): Promise<PendingInvitation[]> {
  return db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, organizationId),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(invitation.createdAt));
}

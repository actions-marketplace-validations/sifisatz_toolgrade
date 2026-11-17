"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db/client";
import { organization } from "@/db/schema";
import { getAuth } from "@/lib/auth";

// Authorization for all three actions below lives in Better Auth's organization plugin itself
// (auth.api.removeMember/updateMemberRole/leaveOrganization), not here: it already checks the
// caller's role (owner/admin only for removeMember and updateMemberRole) and already refuses to
// remove or demote an organization's last owner. These are thin wrappers that resolve a slug to
// an organizationId and surface its errors, not a second copy of that policy.

const Slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/);

async function orgIdForSlug(slug: unknown): Promise<string | undefined> {
  const parsed = Slug.safeParse(slug);
  if (!parsed.success) return undefined;
  const db = await getDb();
  const [row] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, parsed.data))
    .limit(1);
  return row?.id;
}

export type MemberActionState = { ok: boolean; error?: string };

function actionError(err: unknown, fallback: string): MemberActionState {
  return { ok: false, error: err instanceof Error ? err.message : fallback };
}

/** Removes a member by id or email - owner/admin only, and never the org's last owner (enforced by the organization plugin, not here). */
export async function removeOrgMember(
  orgSlug: string,
  memberIdOrEmail: string,
): Promise<MemberActionState> {
  const organizationId = await orgIdForSlug(orgSlug);
  if (!organizationId) return { ok: false, error: "Organization not found." };

  const auth = await getAuth();
  try {
    await auth.api.removeMember({
      body: { memberIdOrEmail, organizationId },
      headers: await headers(),
    });
    return { ok: true };
  } catch (err) {
    return actionError(err, "Could not remove the member.");
  }
}

/** Changes a member's role (memberId is the member row's id, not the user's id) - owner/admin only, and never demotes the org's last owner. */
export async function updateOrgMemberRole(
  orgSlug: string,
  memberId: string,
  role: "member" | "admin" | "owner",
): Promise<MemberActionState> {
  const organizationId = await orgIdForSlug(orgSlug);
  if (!organizationId) return { ok: false, error: "Organization not found." };

  const auth = await getAuth();
  try {
    await auth.api.updateMemberRole({
      body: { memberId, role, organizationId },
      headers: await headers(),
    });
    return { ok: true };
  } catch (err) {
    return actionError(err, "Could not update the member's role.");
  }
}

/** A member removing themselves - refused for the org's last owner, same as removeOrgMember. */
export async function leaveOrg(orgSlug: string): Promise<MemberActionState> {
  const organizationId = await orgIdForSlug(orgSlug);
  if (!organizationId) return { ok: false, error: "Organization not found." };

  const auth = await getAuth();
  try {
    await auth.api.leaveOrganization({
      body: { organizationId },
      headers: await headers(),
    });
    return { ok: true };
  } catch (err) {
    return actionError(err, "Could not leave the organization.");
  }
}

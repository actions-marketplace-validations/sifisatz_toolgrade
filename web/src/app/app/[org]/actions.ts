"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db/client";
import { organization } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { cancelSubscriptionsFor } from "@/lib/billing";

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
    refresh();
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
    refresh();
    return { ok: true };
  } catch (err) {
    return actionError(err, "Could not update the member's role.");
  }
}

export type InviteActionState = MemberActionState & { invitationId?: string };

/**
 * Invites someone by email - owner/admin only (enforced by the organization plugin). There is no
 * outbound email yet (see web/README.md's Operations section), so the caller gets the invitation
 * id back to build a shareable link themselves (`/accept-invite/<id>`); the invited person still
 * needs a session with a matching email to view or accept it.
 */
export async function inviteMember(
  orgSlug: string,
  email: string,
  role: "member" | "admin",
): Promise<InviteActionState> {
  const organizationId = await orgIdForSlug(orgSlug);
  if (!organizationId) return { ok: false, error: "Organization not found." };

  const auth = await getAuth();
  try {
    const invitation = await auth.api.createInvitation({
      body: { email, role, organizationId },
      headers: await headers(),
    });
    refresh();
    return { ok: true, invitationId: invitation.id };
  } catch (err) {
    return actionError(err, "Could not send the invitation.");
  }
}

/** Cancels a pending invitation - owner/admin only (enforced by the organization plugin). */
export async function cancelInvitation(
  orgSlug: string,
  invitationId: string,
): Promise<MemberActionState> {
  const organizationId = await orgIdForSlug(orgSlug);
  if (!organizationId) return { ok: false, error: "Organization not found." };

  const auth = await getAuth();
  try {
    await auth.api.cancelInvitation({
      body: { invitationId },
      headers: await headers(),
    });
    refresh();
    return { ok: true };
  } catch (err) {
    return actionError(err, "Could not cancel the invitation.");
  }
}

/**
 * Permanently deletes an org and everything under it (projects, keys, runs - the database cascade
 * does the rest) - owners only (enforced by the organization plugin; admins cannot). Requires
 * typing the org's slug to confirm, checked here too, not just in the form, since this is
 * irreversible. Cancels any live Stripe subscription first: once the org's gone, so is the only
 * record of which subscription was ever its own.
 */
export async function deleteOrg(
  orgSlug: string,
  confirmSlug: string,
): Promise<MemberActionState> {
  if (confirmSlug !== orgSlug)
    return {
      ok: false,
      error: "Type the organization's slug exactly to confirm.",
    };
  const organizationId = await orgIdForSlug(orgSlug);
  if (!organizationId) return { ok: false, error: "Organization not found." };

  const db = await getDb();
  try {
    await cancelSubscriptionsFor(db, { organizationId });
  } catch (err) {
    return actionError(
      err,
      "Could not cancel this organization's billing - try again before deleting it.",
    );
  }

  const auth = await getAuth();
  try {
    await auth.api.deleteOrganization({
      body: { organizationId },
      headers: await headers(),
    });
    return { ok: true };
  } catch (err) {
    return actionError(err, "Could not delete the organization.");
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
    refresh();
    return { ok: true };
  } catch (err) {
    return actionError(err, "Could not leave the organization.");
  }
}

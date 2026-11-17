"use server";

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

// Authorization and every business rule (matching email, not expired, membership limits) live in
// Better Auth's organization plugin itself (auth.api.acceptInvitation/rejectInvitation) - these
// are thin wrappers that surface its errors, same pattern as app/[org]/actions.ts.

export type InviteResponseState = { ok?: boolean; error?: string };

export async function acceptInvitation(
  invitationId: string,
): Promise<InviteResponseState> {
  const auth = await getAuth();
  try {
    await auth.api.acceptInvitation({
      body: { invitationId },
      headers: await headers(),
    });
    return { ok: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Could not accept the invitation.",
    };
  }
}

export async function rejectInvitation(
  invitationId: string,
): Promise<InviteResponseState> {
  const auth = await getAuth();
  try {
    await auth.api.rejectInvitation({
      body: { invitationId },
      headers: await headers(),
    });
    return { ok: true };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not decline the invitation.",
    };
  }
}

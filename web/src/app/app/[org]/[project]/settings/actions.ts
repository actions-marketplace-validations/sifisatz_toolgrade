"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { apiKeys, member, organization, projects } from "@/db/schema";
import { generateApiKey } from "@/lib/api-keys";
import { getSession, MANAGE_ROLES } from "@/lib/session";

// Server actions are public endpoints: each one re-checks the session and the caller's role in
// the project's org itself (the proxy is only a redirect optimisation), and validates every
// argument before it reaches the database.

const Slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/);
const Target = z.object({ orgSlug: Slug, projectSlug: Slug });

/** The project, only if the signed-in user may manage it (owner or admin of its org). */
async function findManagedProject(orgSlug: unknown, projectSlug: unknown) {
  const target = Target.safeParse({ orgSlug, projectSlug });
  if (!target.success) return undefined;
  const s = await getSession();
  if (!s) return undefined;
  const db = await getDb();
  const [row] = await db
    .select({ id: projects.id, role: member.role })
    .from(projects)
    .innerJoin(organization, eq(projects.orgId, organization.id))
    .innerJoin(member, eq(member.organizationId, organization.id))
    .where(
      and(
        eq(organization.slug, target.data.orgSlug),
        eq(projects.slug, target.data.projectSlug),
        eq(member.userId, s.user.id),
      ),
    )
    .limit(1);
  return row && MANAGE_ROLES.has(row.role) ? row : undefined;
}

export type CreateKeyState = { key?: string; error?: string };

export async function createApiKey(
  orgSlug: string,
  projectSlug: string,
  _prev: CreateKeyState,
  form: FormData,
): Promise<CreateKeyState> {
  const name = z.string().trim().min(1).max(80).safeParse(form.get("name"));
  if (!name.success)
    return {
      error: "Give the key a name of up to 80 characters, e.g. github-actions.",
    };
  const project = await findManagedProject(orgSlug, projectSlug);
  if (!project)
    return { error: "Project not found, or you cannot manage its keys." };
  const { key, prefix, hash } = generateApiKey();
  const db = await getDb();
  await db
    .insert(apiKeys)
    .values({ projectId: project.id, name: name.data, prefix, hash });
  refresh();
  return { key };
}

export async function revokeApiKey(
  orgSlug: string,
  projectSlug: string,
  keyId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!z.uuid().safeParse(keyId).success)
    return { ok: false, error: "Unknown key." };
  const project = await findManagedProject(orgSlug, projectSlug);
  if (!project)
    return {
      ok: false,
      error: "Project not found, or you cannot manage its keys.",
    };
  const db = await getDb();
  const revoked = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.projectId, project.id),
        isNull(apiKeys.revokedAt),
      ),
    )
    .returning({ id: apiKeys.id });
  if (revoked.length === 0)
    return { ok: false, error: "Key not found or already revoked." };
  refresh();
  return { ok: true };
}

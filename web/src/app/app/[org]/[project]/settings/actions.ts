"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { apiKeys, orgs, projects } from "@/db/schema";
import { generateApiKey } from "@/lib/api-keys";

// PoC: the demo workspace has no sign-in, so these actions only check that the project exists
// in the named org. Production adds a session + org-membership check here (Better Auth).
// Server actions are public endpoints: every argument is validated before it reaches the DB.

const Slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/);
const Target = z.object({ orgSlug: Slug, projectSlug: Slug });

async function findProject(orgSlug: unknown, projectSlug: unknown) {
  const target = Target.safeParse({ orgSlug, projectSlug });
  if (!target.success) return undefined;
  const db = await getDb();
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .innerJoin(orgs, eq(projects.orgId, orgs.id))
    .where(
      and(
        eq(orgs.slug, target.data.orgSlug),
        eq(projects.slug, target.data.projectSlug),
      ),
    )
    .limit(1);
  return row;
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
  const project = await findProject(orgSlug, projectSlug);
  if (!project) return { error: "Project not found." };
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
  const project = await findProject(orgSlug, projectSlug);
  if (!project) return { ok: false, error: "Project not found." };
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

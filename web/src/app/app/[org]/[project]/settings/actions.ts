"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { apiKeys, orgs, projects } from "@/db/schema";
import { generateApiKey } from "@/lib/api-keys";

// PoC: the demo workspace has no sign-in, so these actions only check that the project exists
// in the named org. Production adds a session + org-membership check here (Better Auth).

async function findProject(orgSlug: string, projectSlug: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .innerJoin(orgs, eq(projects.orgId, orgs.id))
    .where(and(eq(orgs.slug, orgSlug), eq(projects.slug, projectSlug)))
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
  const name = String(form.get("name") ?? "")
    .trim()
    .slice(0, 80);
  if (!name) return { error: "Give the key a name, e.g. github-actions." };
  const project = await findProject(orgSlug, projectSlug);
  if (!project) return { error: "Project not found." };
  const { key, prefix, hash } = generateApiKey();
  const db = await getDb();
  await db
    .insert(apiKeys)
    .values({ projectId: project.id, name, prefix, hash });
  refresh();
  return { key };
}

export async function revokeApiKey(
  orgSlug: string,
  projectSlug: string,
  keyId: string,
) {
  const project = await findProject(orgSlug, projectSlug);
  if (!project) return;
  const db = await getDb();
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.projectId, project.id),
        isNull(apiKeys.revokedAt),
      ),
    );
  refresh();
}

"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { organization, projects } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { slugify } from "@/lib/slug";

export type OnboardingState = { error?: string };

const Input = z.object({
  workspace: z.string().trim().min(2, "Name your workspace").max(60),
  project: z.string().trim().min(2, "Name your first project").max(60),
});

async function freeOrgSlug(base: string): Promise<string> {
  const db = await getDb();
  for (let i = 0; i < 5; i++) {
    const slug = i === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const [taken] = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, slug))
      .limit(1);
    if (!taken) return slug;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}

export async function createWorkspace(
  _prev: OnboardingState,
  form: FormData,
): Promise<OnboardingState> {
  const s = await getSession();
  if (!s) redirect("/sign-in?next=/onboarding");
  const parsed = Input.safeParse({
    workspace: form.get("workspace"),
    project: form.get("project"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };

  const auth = await getAuth();
  const slug = await freeOrgSlug(slugify(parsed.data.workspace));
  // The organization plugin makes the creator its owner.
  const org = await auth.api.createOrganization({
    body: { name: parsed.data.workspace, slug },
    headers: await headers(),
  });
  if (!org) return { error: "Could not create the workspace. Try again." };

  const projectSlug = slugify(parsed.data.project);
  const db = await getDb();
  await db
    .insert(projects)
    .values({ orgId: org.id, slug: projectSlug, name: parsed.data.project });
  redirect(`/app/${slug}/${projectSlug}/settings`);
}

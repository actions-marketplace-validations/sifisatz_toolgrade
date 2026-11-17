"use server";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  apiKeys,
  member,
  organization,
  projects,
  subscriptions,
} from "@/db/schema";
import { generateApiKey } from "@/lib/api-keys";
import { createCheckoutSession, createPortalSession } from "@/lib/billing";
import { isPlanId, PLANS } from "@/lib/plans";
import { getSession, MANAGE_ROLES } from "@/lib/session";
import { getStripe } from "@/lib/stripe";

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
    .select({ id: projects.id, orgId: projects.orgId, role: member.role })
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

/** The org, only if the signed-in user may manage its billing (owner or admin). */
async function findManagedOrg(orgSlug: unknown) {
  const slug = Slug.safeParse(orgSlug);
  if (!slug.success) return undefined;
  const s = await getSession();
  if (!s) return undefined;
  const db = await getDb();
  const [row] = await db
    .select({ id: organization.id, role: member.role })
    .from(organization)
    .innerJoin(member, eq(member.organizationId, organization.id))
    .where(and(eq(organization.slug, slug.data), eq(member.userId, s.user.id)))
    .limit(1);
  return row && MANAGE_ROLES.has(row.role) ? row : undefined;
}

function appOrigin(): string {
  const url = process.env.BETTER_AUTH_URL;
  if (!url) throw new Error("BETTER_AUTH_URL is not set");
  return url.replace(/\/+$/, "");
}

/** The Stripe customer id already on file for this org, from any of its subscriptions (one Stripe customer per org, shared across its projects' plans). */
async function existingCustomerId(orgId: string): Promise<string | undefined> {
  const db = await getDb();
  const [row] = await db
    .select({ providerCustomerId: subscriptions.providerCustomerId })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.organizationId, orgId),
        isNotNull(subscriptions.providerCustomerId),
      ),
    )
    .limit(1);
  return row?.providerCustomerId ?? undefined;
}

export type CheckoutState = { url?: string; error?: string };

/**
 * Starts a Stripe Checkout for a paid plan. Does not touch the subscriptions table itself - see
 * lib/billing.ts's upsertFromSubscription, which only a verified webhook ever calls, since
 * reaching success_url proves nothing on its own (closed tab, killed browser, delayed webhook).
 */
export async function startCheckout(
  orgSlug: string,
  projectSlug: string,
  plan: string,
): Promise<CheckoutState> {
  if (!isPlanId(plan) || plan === "free") return { error: "Not a paid plan." };
  const def = PLANS[plan];

  let organizationId: string;
  let projectId: string | undefined;
  if (def.scope === "project") {
    const project = await findManagedProject(orgSlug, projectSlug);
    if (!project)
      return { error: "Project not found, or you cannot manage its billing." };
    organizationId = project.orgId;
    projectId = project.id;
  } else {
    const org = await findManagedOrg(orgSlug);
    if (!org)
      return {
        error: "Organization not found, or you cannot manage its billing.",
      };
    organizationId = org.id;
  }

  try {
    const { url } = await createCheckoutSession(getStripe(), {
      organizationId,
      projectId,
      plan,
      successUrl: `${appOrigin()}/app/${orgSlug}/${projectSlug}/settings?checkout=success`,
      cancelUrl: `${appOrigin()}/app/${orgSlug}/${projectSlug}/settings?checkout=cancelled`,
      existingCustomerId: await existingCustomerId(organizationId),
    });
    return { url };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not start checkout.",
    };
  }
}

/** Opens the Stripe-hosted billing portal for the org's existing Stripe customer. */
export async function openBillingPortal(
  orgSlug: string,
): Promise<CheckoutState> {
  const org = await findManagedOrg(orgSlug);
  if (!org)
    return {
      error: "Organization not found, or you cannot manage its billing.",
    };
  const customerId = await existingCustomerId(org.id);
  if (!customerId)
    return { error: "No billing history yet - subscribe to a plan first." };
  try {
    const { url } = await createPortalSession(getStripe(), {
      customerId,
      returnUrl: `${appOrigin()}/app/${orgSlug}`,
    });
    return { url };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not open the billing portal.",
    };
  }
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

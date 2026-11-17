"use server";

import { headers } from "next/headers";
import { getDb } from "@/db/client";
import { ApplicationInput, submitApplication } from "@/lib/design-partners";
import { checkRateLimit } from "@/lib/rate-limit";

export type ApplyState = { ok?: boolean; error?: string };

// No account and no API key guard this form - it's reachable by anyone with the URL, bots
// included. Two cheap defenses, no new infrastructure: a per-IP rate limit (same rate_limit
// table every other limiter shares) and a honeypot field real visitors never see or fill.
const RATE_LIMIT = { windowSeconds: 3600, max: 5 };

async function clientIp(): Promise<string> {
  const forwardedFor = (await headers()).get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

export async function applyAsDesignPartner(
  _prev: ApplyState,
  form: FormData,
): Promise<ApplyState> {
  if (form.get("website")) return { ok: true };

  const parsed = ApplicationInput.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    company: form.get("company") || undefined,
    mcpServer: form.get("mcpServer"),
    notes: form.get("notes") || undefined,
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };

  const db = await getDb();
  const ip = await clientIp();
  const withinRate = await checkRateLimit(
    db,
    `design-partner:${ip}`,
    RATE_LIMIT.windowSeconds,
    RATE_LIMIT.max,
  );
  if (!withinRate)
    return {
      error: "Too many submissions from this network - try again later.",
    };

  await submitApplication(db, parsed.data);
  return { ok: true };
}

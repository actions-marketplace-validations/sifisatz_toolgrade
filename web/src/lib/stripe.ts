import "server-only";
import Stripe from "stripe";
import { PLAN_IDS, type PlanId } from "@/lib/plans";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is not set - see README for Stripe setup`);
  return value;
}

const g = globalThis as unknown as { __toolgradeStripe?: Stripe };

/** The Stripe client, created once per process from STRIPE_SECRET_KEY. Throws if it's unset. */
export function getStripe(): Stripe {
  g.__toolgradeStripe ??= new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  return g.__toolgradeStripe;
}

const PRICE_ENV_VAR: Partial<Record<PlanId, string>> = {
  early_access: "STRIPE_PRICE_EARLY_ACCESS",
  team: "STRIPE_PRICE_TEAM",
  growth: "STRIPE_PRICE_GROWTH",
};

/** The Stripe Price id configured for a paid plan - undefined for "free" or an unconfigured env var. */
export function priceIdForPlan(plan: PlanId): string | undefined {
  const envVar = PRICE_ENV_VAR[plan];
  return envVar ? process.env[envVar] : undefined;
}

/**
 * The reverse lookup, derived from the same env vars so the two can never drift apart - the only
 * place a Stripe price id turns into one of our plans. A price nobody configured here (or one
 * left over from a retired plan) correctly maps to nothing rather than a guess.
 */
export function planForPriceId(priceId: string): PlanId | undefined {
  return PLAN_IDS.find((plan) => priceIdForPlan(plan) === priceId);
}

export function requireWebhookSecret(): string {
  return requireEnv("STRIPE_WEBHOOK_SECRET");
}

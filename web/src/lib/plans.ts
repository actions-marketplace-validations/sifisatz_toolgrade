// Plan definitions only - no DB access and no enforcement here. lib/entitlements.ts resolves which
// plan an org/project is on; enforcing a limit (max projects, monthly units, retention) is a
// separate, later change that reads these numbers at the point that matters. Keeping this file
// pure data means a pricing change is a diff here, not a hunt through server actions and routes.

export const PLAN_IDS = ["free", "early_access", "team", "growth"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Whether a plan's subscription lives on one project or covers every project in the org. */
export type PlanScope = "project" | "organization";

export interface Plan {
  id: PlanId;
  name: string;
  scope: PlanScope;
  priceUsd: number | null;
  maxProjects: number;
  monthlyEvaluationUnits: number;
  retentionDays: number | null;
  teamCollaboration: boolean;
  advancedComparisons: boolean;
}

/**
 * One evaluation unit = one task evaluated across both arms (tools, baseline) for one trial, i.e.
 * `taskCount * trialsPerTask` for a completed run. See lib/usage.ts (not yet built) for how a
 * run's units get counted - this is just the monthly allowance per plan.
 */
export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    scope: "project",
    priceUsd: 0,
    maxProjects: 0,
    monthlyEvaluationUnits: 0,
    retentionDays: null,
    teamCollaboration: false,
    advancedComparisons: false,
  },
  early_access: {
    id: "early_access",
    name: "Early Access",
    scope: "project",
    priceUsd: 29,
    maxProjects: 1,
    monthlyEvaluationUnits: 1000,
    retentionDays: 90,
    teamCollaboration: false,
    advancedComparisons: false,
  },
  team: {
    id: "team",
    name: "Team",
    scope: "project",
    priceUsd: 49,
    maxProjects: 1,
    monthlyEvaluationUnits: 2500,
    retentionDays: 365,
    teamCollaboration: true,
    advancedComparisons: true,
  },
  growth: {
    id: "growth",
    name: "Growth",
    scope: "organization",
    priceUsd: 99,
    maxProjects: 5,
    monthlyEvaluationUnits: 5000,
    retentionDays: 365,
    teamCollaboration: true,
    advancedComparisons: true,
  },
};

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

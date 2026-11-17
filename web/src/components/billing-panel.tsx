"use client";

import { CreditCard, Sparkles } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  openBillingPortal,
  startCheckout,
} from "@/app/app/[org]/[project]/settings/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dateTime, usd } from "@/lib/format";
import { PLANS, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  canceled: "Canceled",
  incomplete: "Incomplete",
  incomplete_expired: "Incomplete (expired)",
  unpaid: "Unpaid",
  paused: "Paused",
};

function goTo(url: string) {
  window.location.href = url;
}

export function BillingPanel({
  orgSlug,
  projectSlug,
  planId,
  status,
  currentPeriodEnd,
  usageUsed,
  usageLimit,
  maxProjects,
  retentionDays,
  canManage,
}: {
  orgSlug: string;
  projectSlug: string;
  planId: PlanId;
  status?: string;
  currentPeriodEnd?: Date;
  usageUsed: number;
  usageLimit: number;
  maxProjects: number;
  retentionDays: number | null;
  canManage: boolean;
}) {
  const [pending, startAction] = useTransition();
  const plan = PLANS[planId];

  function run(action: () => Promise<{ url?: string; error?: string }>) {
    startAction(async () => {
      const res = await action();
      if (res.url) goTo(res.url);
      else toast.error(res.error ?? "Something went wrong.");
    });
  }

  const usagePct =
    usageLimit > 0
      ? Math.min(100, Math.round((usageUsed / usageLimit) * 100))
      : 0;
  const upgradeTargets = (["early_access", "team", "growth"] as const).filter(
    (id) => id !== planId,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-lg font-semibold">{plan.name}</span>
        {plan.priceUsd !== null && plan.priceUsd > 0 && (
          <span className="text-sm text-muted-foreground">
            {usd(plan.priceUsd)}/month
          </span>
        )}
        {status && (
          <Badge
            variant={
              status === "active" || status === "trialing"
                ? "secondary"
                : "destructive"
            }
          >
            {STATUS_LABEL[status] ?? status}
          </Badge>
        )}
      </div>

      {currentPeriodEnd && (
        <p className="text-sm text-muted-foreground">
          Renews {dateTime(currentPeriodEnd)}
        </p>
      )}

      {usageLimit <= 0 ? (
        <p className="text-sm text-muted-foreground">
          {usageUsed.toLocaleString("en-US")} evaluation unit
          {usageUsed === 1 ? "" : "s"} uploaded - this plan has no hosted
          allowance. Subscribe to a paid plan for a monthly allowance and longer
          run retention.
        </p>
      ) : (
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Evaluation units this period
            </span>
            <span className="tabular-nums">
              {usageUsed.toLocaleString("en-US")} /{" "}
              {usageLimit.toLocaleString("en-US")}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                usagePct >= 100
                  ? "bg-status-critical"
                  : usagePct >= 90
                    ? "bg-status-warning"
                    : "bg-primary",
              )}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          {usageUsed >= usageLimit ? (
            <p className="mt-1.5 text-xs text-status-critical">
              Monthly allowance reached - new uploads will be rejected until it
              renews{planId !== "free" ? " or you upgrade" : ""}.
            </p>
          ) : usagePct >= 90 ? (
            <p className="mt-1.5 text-xs text-status-warning">
              Nearly at your monthly allowance.
            </p>
          ) : usagePct >= 70 ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Approaching your monthly allowance.
            </p>
          ) : null}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3 text-sm">
          <div className="text-muted-foreground">Projects</div>
          <div className="font-medium">
            {maxProjects > 0
              ? `up to ${maxProjects}`
              : "hosted history not included"}
          </div>
        </div>
        <div className="rounded-lg border p-3 text-sm">
          <div className="text-muted-foreground">Run retention</div>
          <div className="font-medium">
            {retentionDays ? `${retentionDays} days` : "local only"}
          </div>
        </div>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2 pt-1">
          {planId !== "free" && (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => run(() => openBillingPortal(orgSlug))}
            >
              <CreditCard /> Manage billing
            </Button>
          )}
          {upgradeTargets.map((id) => (
            <Button
              key={id}
              variant="outline"
              disabled={pending}
              onClick={() => run(() => startCheckout(orgSlug, projectSlug, id))}
            >
              <Sparkles /> {planId === "free" ? "Subscribe to" : "Switch to"}{" "}
              {PLANS[id].name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

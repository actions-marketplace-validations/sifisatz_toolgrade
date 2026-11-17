import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BillingPanel } from "@/components/billing-panel";

const base = {
  orgSlug: "o",
  projectSlug: "p",
  planId: "early_access" as const,
  maxProjects: 1,
  retentionDays: 90,
  canManage: true,
};

function html(usageUsed: number, usageLimit = 1000) {
  return renderToStaticMarkup(
    createElement(BillingPanel, { ...base, usageUsed, usageLimit }),
  );
}

describe("BillingPanel usage warnings", () => {
  it("shows no warning well under the allowance", () => {
    const out = html(500);
    expect(out).not.toContain("Approaching");
    expect(out).not.toContain("Nearly at");
    expect(out).not.toContain("reached");
  });

  it("warns at 70%", () => {
    const out = html(700);
    expect(out).toContain("Approaching your monthly allowance");
  });

  it("warns more urgently at 90%", () => {
    const out = html(900);
    expect(out).toContain("Nearly at your monthly allowance");
    expect(out).not.toContain("Approaching");
  });

  it("says the allowance is reached once usage meets the limit", () => {
    const out = html(1000);
    expect(out).toContain("Monthly allowance reached");
    expect(out).toContain("or you upgrade");
  });

  it("does not suggest upgrading when already on the free plan with no allowance", () => {
    const out = renderToStaticMarkup(
      createElement(BillingPanel, {
        ...base,
        planId: "free",
        usageUsed: 50,
        usageLimit: 0,
      }),
    );
    expect(out).toContain("no hosted allowance");
    expect(out).not.toContain("or you upgrade");
  });
});

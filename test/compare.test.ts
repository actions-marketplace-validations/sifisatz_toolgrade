import { describe, expect, it } from "vitest";
import { compareRuns } from "../src/compare.js";
import { formatComparison } from "../src/report.js";
import type { RunReport } from "../src/runner.js";

function report(toolNames: string[], overrides: Partial<RunReport> = {}): RunReport {
  return {
    tasks: [{ taskId: "t", prompt: "p", tags: [], tools: { rate: { passes: 3, n: 3, rate: 1, low: 0.5, high: 1 }, errors: 0, meanToolCalls: 1, meanTurns: 1, meanInputTokens: 0, meanOutputTokens: 0, meanDurationMs: 0, costUsd: 0 } }],
    toolSurface: {
      count: toolNames.length,
      names: toolNames,
      schemaChars: 0,
      approxTokens: 0,
      fingerprint: "fp",
      tools: toolNames.map((name) => ({ name, hash: `hash-${name}` })),
    },
    ...overrides,
  } as unknown as RunReport;
}

describe("compareRuns tool surface diff", () => {
  it("reports no change when the tool set and hashes are identical", () => {
    const cmp = compareRuns(report(["a", "b"]), report(["a", "b"]));
    expect(cmp.toolSurface).toEqual({ changed: false, added: [], removed: [], changedTools: [] });
  });

  it("detects an added tool", () => {
    const cmp = compareRuns(report(["a"]), report(["a", "b"]));
    expect(cmp.toolSurface).toMatchObject({ changed: true, added: ["b"], removed: [] });
  });

  it("detects a removed tool", () => {
    const cmp = compareRuns(report(["a", "b"]), report(["a"]));
    expect(cmp.toolSurface).toMatchObject({ changed: true, added: [], removed: ["b"] });
  });

  it("detects a changed tool (same name, different hash)", () => {
    const before = report(["a"]);
    const after = report(["a"]);
    after.toolSurface.tools = [{ name: "a", hash: "different-hash" }];
    const cmp = compareRuns(before, after);
    expect(cmp.toolSurface).toMatchObject({ changed: true, changedTools: ["a"], added: [], removed: [] });
  });

  it("does not crash on a report with no tools array at all (an older report version)", () => {
    const before = report(["a"]);
    const after = report(["a"]);
    // @ts-expect-error simulating a pre-fingerprint report loaded from disk
    delete before.toolSurface.tools;
    const cmp = compareRuns(before, after);
    expect(cmp.toolSurface.changed).toBe(true); // "a" looks added since the old report has no tools list
  });
});

describe("formatComparison warns about an unstable comparison", () => {
  it("includes a tool-surface-changed warning with the specific tools when the surface differs", () => {
    const cmp = compareRuns(report(["a"]), report(["a", "b"]));
    const text = formatComparison(cmp);
    expect(text).toContain("tool surface changed");
    expect(text).toContain("added: b");
  });

  it("says nothing about the tool surface when it is unchanged", () => {
    const cmp = compareRuns(report(["a", "b"]), report(["a", "b"]));
    expect(formatComparison(cmp)).not.toContain("tool surface");
  });
});

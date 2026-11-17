import type { RunReport } from "toolgrade/core";

export interface ToolUsage {
  name: string;
  timesCalled: number;
  errors: number;
}

export interface ToolSurfaceBreakdown {
  /** Tools that were called at least once, most-used first. */
  used: ToolUsage[];
  /** Tools in the server's tool surface that no trial ever called. */
  neverCalled: string[];
}

/**
 * How much of a run's tool surface actually got exercised - derived entirely from data already in
 * the report (toolSurface.names, trials[].trajectory.toolCalls), no new fields needed. A tool
 * being called at all doesn't mean it's useful (see README's statistics notes on lift vs calls),
 * but a tool that's *never* called in a whole run is at least worth a second look.
 */
export function toolSurfaceBreakdown(report: RunReport): ToolSurfaceBreakdown {
  const counts = new Map<string, { timesCalled: number; errors: number }>();
  for (const trial of report.trials) {
    if (!trial.trajectory) continue;
    for (const call of trial.trajectory.toolCalls) {
      const entry = counts.get(call.name) ?? { timesCalled: 0, errors: 0 };
      entry.timesCalled++;
      if (call.isError) entry.errors++;
      counts.set(call.name, entry);
    }
  }
  const used = [...counts.entries()]
    .map(([name, c]) => ({ name, ...c }))
    .sort((a, b) => b.timesCalled - a.timesCalled);
  const neverCalled = report.toolSurface.names.filter((n) => !counts.has(n));
  return { used, neverCalled };
}

import type { RunReport } from "./runner.js";
import { difference, significance, type Difference, type Significance } from "./stats.js";

export interface TaskComparison {
  taskId: string;
  before: number;
  after: number;
  diff: Difference;
  significance: Significance;
}

export interface Comparison {
  verdict: "regressed" | "improved" | "no_significant_change";
  overall: { before: number; after: number; diff: Difference; significance: Significance };
  tasks: TaskComparison[];
  /** Tasks present in only one of the two runs; compared runs should share a suite. */
  unmatched: string[];
}

export function compareRuns(before: RunReport, after: RunReport): Comparison {
  const diff = difference(after.overall.tools.rate, before.overall.tools.rate);
  const overallSig = significance(diff);
  const beforeTasks = new Map(before.tasks.map((t) => [t.taskId, t]));
  const afterIds = new Set(after.tasks.map((t) => t.taskId));

  const tasks: TaskComparison[] = [];
  for (const t of after.tasks) {
    const prev = beforeTasks.get(t.taskId);
    if (!prev) continue;
    const d = difference(t.tools.rate, prev.tools.rate);
    tasks.push({ taskId: t.taskId, before: prev.tools.rate.rate, after: t.tools.rate.rate, diff: d, significance: significance(d) });
  }
  const unmatched = [
    ...before.tasks.filter((t) => !afterIds.has(t.taskId)).map((t) => t.taskId),
    ...after.tasks.filter((t) => !beforeTasks.has(t.taskId)).map((t) => t.taskId),
  ];

  const anyWorse = overallSig === "worse" || tasks.some((t) => t.significance === "worse");
  const verdict = anyWorse ? "regressed" : overallSig === "better" ? "improved" : "no_significant_change";
  return {
    verdict,
    overall: { before: before.overall.tools.rate.rate, after: after.overall.tools.rate.rate, diff, significance: overallSig },
    tasks,
    unmatched,
  };
}

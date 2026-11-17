import type { RunReport } from "./runner.js";
import { bonferroniZ, difference, rate, significance, taskLevelRate, type Difference, type Significance } from "./stats.js";

export interface TaskComparison {
  taskId: string;
  before: number;
  after: number;
  diff: Difference;
  /** Bonferroni-corrected across all compared tasks, so big suites do not cry wolf. */
  significance: Significance;
}

export interface ToolSurfaceDiff {
  /** True whenever anything below is non-empty - a quick "don't trust this comparison blindly" flag. */
  changed: boolean;
  added: string[];
  removed: string[];
  /** Present in both runs, but the tool's description or input schema differs. */
  changedTools: string[];
}

export interface Comparison {
  verdict: "regressed" | "improved" | "no_significant_change";
  /** Over matched tasks only, task-level (n = tasks), so different task sets never get mixed. */
  overall: { before: number; after: number; tasks: number; diff: Difference; significance: Significance };
  tasks: TaskComparison[];
  /** Tasks present (and graded) in only one of the two runs; excluded from every number above. */
  unmatched: string[];
  /** Whether the two runs even evaluated the same tool surface - a pass-rate change alongside a
   * changed tool surface may be explained by the tools, not by anything else that differs between
   * the runs (model, prompt, server logic). Never silently assumed to be comparable. */
  toolSurface: ToolSurfaceDiff;
}

function diffToolSurface(before: RunReport, after: RunReport): ToolSurfaceDiff {
  // Defensive: a report from before this field existed has no `tools` array at runtime even
  // though the type says it must - treated as "unknown," not a crash.
  const b = new Map((before.toolSurface.tools ?? []).map((t) => [t.name, t.hash]));
  const a = new Map((after.toolSurface.tools ?? []).map((t) => [t.name, t.hash]));
  const added = [...a.keys()].filter((name) => !b.has(name)).sort();
  const removed = [...b.keys()].filter((name) => !a.has(name)).sort();
  const changedTools = [...a.keys()].filter((name) => b.has(name) && b.get(name) !== a.get(name)).sort();
  return { changed: added.length > 0 || removed.length > 0 || changedTools.length > 0, added, removed, changedTools };
}

export function compareRuns(before: RunReport, after: RunReport): Comparison {
  const graded = (r: RunReport) => new Map(r.tasks.filter((t) => t.tools.rate.n > 0).map((t) => [t.taskId, t.tools.rate]));
  const b = graded(before);
  const a = graded(after);
  const matched = [...a.keys()].filter((id) => b.has(id));
  const unmatched = [...b.keys(), ...a.keys()].filter((id) => !(b.has(id) && a.has(id)));

  const z = bonferroniZ(matched.length);
  const tasks: TaskComparison[] = matched.map((id) => {
    const prev = b.get(id)!;
    const next = a.get(id)!;
    const diff = difference(rate(next.passes, next.n, z), rate(prev.passes, prev.n, z));
    return { taskId: id, before: prev.rate, after: next.rate, diff, significance: significance(diff) };
  });

  const beforeRate = taskLevelRate(matched.map((id) => b.get(id)!.rate));
  const afterRate = taskLevelRate(matched.map((id) => a.get(id)!.rate));
  const diff = difference(afterRate, beforeRate);
  const overallSig = significance(diff);

  const anyWorse = overallSig === "worse" || tasks.some((t) => t.significance === "worse");
  const anyBetter = overallSig === "better" || tasks.some((t) => t.significance === "better");
  const verdict = anyWorse ? "regressed" : anyBetter ? "improved" : "no_significant_change";
  return {
    verdict,
    overall: { before: beforeRate.rate, after: afterRate.rate, tasks: matched.length, diff, significance: overallSig },
    tasks,
    unmatched,
    toolSurface: diffToolSurface(before, after),
  };
}

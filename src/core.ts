// Browser-safe entry: pure statistics, comparison and report types. No Node, MCP or model SDKs.
export { compareRuns, type Comparison, type TaskComparison } from "./compare.js";
export { bonferroniZ, difference, pct, probit, rate, significance, signedPct, taskLevelRate, wilson } from "./stats.js";
export type { Difference, Interval, Rate, Significance } from "./stats.js";
export type { AssertionResult } from "./assertions.js";
export type { ToolCallRecord, Trajectory, Usage } from "./agent.js";
export type { Arm, ArmSummary, GateCheck, OverallArm, RunReport, TaskSummary, TrialResult } from "./runner.js";

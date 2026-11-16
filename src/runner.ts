import { runAgent, toAnthropicTools, type Trajectory } from "./agent.js";
import { evaluateAll, type AssertionResult } from "./assertions.js";
import type { Suite, TaskSpec } from "./config.js";
import { LlmJudge } from "./judge.js";
import { openSession as defaultOpenSession, type McpSession } from "./mcp.js";
import { CostModel } from "./pricing.js";
import type { ModelProvider } from "./providers/types.js";
import { difference, rate, significance, type Difference, type Rate, type Significance } from "./stats.js";

export type Arm = "tools" | "baseline";

export interface TrialResult {
  taskId: string;
  arm: Arm;
  trial: number;
  passed: boolean;
  assertions: AssertionResult[];
  trajectory?: Trajectory;
  error?: string;
  costUsd: number | null;
}

export interface ArmSummary {
  rate: Rate;
  errors: number;
  meanToolCalls: number;
  meanTurns: number;
  meanInputTokens: number;
  meanOutputTokens: number;
  meanDurationMs: number;
  costUsd: number | null;
}

export interface TaskSummary {
  taskId: string;
  tags: string[];
  tools: ArmSummary;
  baseline?: ArmSummary;
  lift?: Difference;
}

export interface GateCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface RunReport {
  version: 1;
  suite: string;
  startedAt: string;
  finishedAt: string;
  provider: string;
  agentModel: string;
  judgeModel: string;
  trialsPerTask: number;
  toolSurface: { count: number; names: string[]; schemaChars: number; approxTokens: number };
  tasks: TaskSummary[];
  overall: { tools: ArmSummary; baseline?: ArmSummary; lift?: Difference; liftSignificance?: Significance };
  judgeCostUsd: number | null;
  totalCostUsd: number | null;
  unpricedModels: string[];
  gate: { passed: boolean; checks: GateCheck[] };
  trials: TrialResult[];
}

export interface RunOptions {
  provider: ModelProvider;
  trials?: number;
  baseline?: boolean;
  concurrency?: number;
  filter?: string;
  openSession?: (server: Suite["server"]) => Promise<McpSession>;
  onTrial?: (t: TrialResult, done: number, total: number) => void;
}

export class FatalRunError extends Error {}

export async function runSuite(suite: Suite, opts: RunOptions): Promise<RunReport> {
  const startedAt = new Date().toISOString();
  const open = opts.openSession ?? defaultOpenSession;
  const trials = opts.trials ?? suite.run.trials;
  const withBaseline = opts.baseline ?? suite.run.baseline;
  const tasks = selectTasks(suite.tasks, opts.filter);
  const costs = new CostModel(suite.pricing);
  const judge = new LlmJudge(opts.provider, suite.judge.model);
  let judgeIn = 0;
  let judgeOut = 0;

  // Probe once up front: fails fast on a broken server before any model spend.
  const probe = await open(suite.server);
  const anthropicTools = toAnthropicTools(probe.tools);
  await probe.close();
  const schemaChars = JSON.stringify(anthropicTools).length;

  const arms: Arm[] = withBaseline ? ["tools", "baseline"] : ["tools"];
  const jobs: Array<{ task: TaskSpec; arm: Arm; trial: number }> = [];
  for (const task of tasks) for (const arm of arms) for (let i = 1; i <= trials; i++) jobs.push({ task, arm, trial: i });

  let done = 0;
  const results = await pool(jobs, opts.concurrency ?? suite.run.concurrency, async ({ task, arm, trial }) => {
    const result = await runTrial(task, arm, trial);
    opts.onTrial?.(result, ++done, jobs.length);
    return result;
  });

  async function runTrial(task: TaskSpec, arm: Arm, trial: number): Promise<TrialResult> {
    let session: McpSession | undefined;
    try {
      // Both arms get a fresh server so `state` assertions see an untouched world in the baseline too.
      session = await open(suite.server);
      const trajectory = await runAgent({
        provider: opts.provider,
        model: suite.agent.model,
        prompt: task.prompt,
        system: suite.agent.system,
        maxTurns: suite.agent.max_turns,
        maxTokens: suite.agent.max_tokens,
        effort: suite.agent.effort,
        session: arm === "tools" ? session : undefined,
      });
      const assertions = await evaluateAll(task.assert, {
        prompt: task.prompt,
        trajectory,
        session,
        judge,
        onJudgeUsage: (i, o) => {
          judgeIn += i;
          judgeOut += o;
        },
      });
      return {
        taskId: task.id,
        arm,
        trial,
        passed: !trajectory.truncated && assertions.every((a) => a.passed),
        assertions,
        trajectory,
        costUsd: costs.cost(suite.agent.model, trajectory.inputTokens, trajectory.outputTokens),
      };
    } catch (err) {
      if (isFatal(err)) throw new FatalRunError(`Aborting run: ${errorMessage(err)}`);
      return { taskId: task.id, arm, trial, passed: false, assertions: [], error: errorMessage(err), costUsd: null };
    } finally {
      await session?.close().catch(() => undefined);
    }
  }

  const taskSummaries: TaskSummary[] = tasks.map((task) => {
    const mine = results.filter((r) => r.taskId === task.id);
    const tools = summarize(mine.filter((r) => r.arm === "tools"));
    const baseline = withBaseline ? summarize(mine.filter((r) => r.arm === "baseline")) : undefined;
    return { taskId: task.id, tags: task.tags, tools, baseline, lift: baseline ? difference(tools.rate, baseline.rate) : undefined };
  });

  const overallTools = summarize(results.filter((r) => r.arm === "tools"));
  const overallBaseline = withBaseline ? summarize(results.filter((r) => r.arm === "baseline")) : undefined;
  const lift = overallBaseline ? difference(overallTools.rate, overallBaseline.rate) : undefined;
  const judgeCostUsd = judgeIn + judgeOut === 0 ? 0 : costs.cost(suite.judge.model, judgeIn, judgeOut);
  const totalCostUsd = sumCosts([overallTools.costUsd, overallBaseline?.costUsd ?? 0, judgeCostUsd]);

  const checks: GateCheck[] = [];
  const errors = results.filter((r) => r.error).length;
  checks.push({ name: "no_errors", passed: errors === 0, detail: `${errors} trial(s) errored` });
  if (suite.gate.min_pass_rate > 0) {
    checks.push({
      name: "min_pass_rate",
      passed: overallTools.rate.rate >= suite.gate.min_pass_rate,
      detail: `pass rate ${pct(overallTools.rate.rate)} vs required ${pct(suite.gate.min_pass_rate)}`,
    });
  }
  if (suite.gate.min_lift !== undefined && lift) {
    checks.push({
      name: "min_lift",
      passed: lift.delta >= suite.gate.min_lift,
      detail: `lift ${signedPct(lift.delta)} vs required ${signedPct(suite.gate.min_lift)}`,
    });
  }

  return {
    version: 1,
    suite: suite.name,
    startedAt,
    finishedAt: new Date().toISOString(),
    provider: opts.provider.name,
    agentModel: suite.agent.model,
    judgeModel: suite.judge.model,
    trialsPerTask: trials,
    toolSurface: { count: probe.tools.length, names: probe.tools.map((t) => t.name), schemaChars, approxTokens: Math.round(schemaChars / 4) },
    tasks: taskSummaries,
    overall: { tools: overallTools, baseline: overallBaseline, lift, liftSignificance: lift ? significance(lift) : undefined },
    judgeCostUsd,
    totalCostUsd,
    unpricedModels: [...costs.unpriced],
    gate: { passed: checks.every((c) => c.passed), checks },
    trials: results,
  };
}

function selectTasks(tasks: TaskSpec[], filter?: string): TaskSpec[] {
  if (!filter) return tasks;
  const picked = tasks.filter((t) => t.id === filter || t.tags.includes(filter));
  if (picked.length === 0) throw new Error(`No task id or tag matches "${filter}"`);
  return picked;
}

function summarize(trials: TrialResult[]): ArmSummary {
  const ok = trials.map((t) => t.trajectory).filter((t): t is Trajectory => t !== undefined);
  const mean = (f: (t: Trajectory) => number) => (ok.length === 0 ? 0 : ok.reduce((s, t) => s + f(t), 0) / ok.length);
  return {
    rate: rate(trials.filter((t) => t.passed).length, trials.length),
    errors: trials.filter((t) => t.error).length,
    meanToolCalls: mean((t) => t.toolCalls.length),
    meanTurns: mean((t) => t.turns),
    meanInputTokens: mean((t) => t.inputTokens),
    meanOutputTokens: mean((t) => t.outputTokens),
    meanDurationMs: mean((t) => t.durationMs),
    costUsd: sumCosts(trials.filter((t) => t.trajectory).map((t) => t.costUsd)),
  };
}

function sumCosts(values: Array<number | null>): number | null {
  return values.some((v) => v === null) ? null : values.reduce<number>((s, v) => s + (v ?? 0), 0);
}

/** Config-level API failures (bad key, unknown model, malformed request) repeat on every trial. */
function isFatal(err: unknown): boolean {
  const e = err as { status?: unknown; fatal?: unknown } | undefined;
  if (e?.fatal === true) return true;
  return typeof e?.status === "number" && [400, 401, 403, 404].includes(e.status);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  let failed: unknown;
  const worker = async () => {
    while (failed === undefined && next < items.length) {
      const i = next++;
      try {
        out[i] = await fn(items[i] as T);
      } catch (err) {
        failed ??= err;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  if (failed !== undefined) throw failed;
  return out;
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const signedPct = (x: number) => `${x >= 0 ? "+" : ""}${Math.round(x * 100)}pp`;

import { isDeepStrictEqual } from "node:util";
import type { Trajectory } from "./agent.js";
import type { AssertionSpec } from "./config.js";
import type { LlmJudge } from "./judge.js";
import type { McpSession } from "./mcp.js";

export interface AssertionResult {
  type: AssertionSpec["type"];
  passed: boolean;
  detail: string;
}

export interface AssertionContext {
  prompt: string;
  trajectory: Trajectory;
  session?: McpSession;
  judge?: LlmJudge;
  onJudgeUsage?: (inputTokens: number, outputTokens: number) => void;
}

export async function evaluateAll(specs: AssertionSpec[], ctx: AssertionContext): Promise<AssertionResult[]> {
  const results: AssertionResult[] = [];
  for (const spec of specs) results.push(await evaluate(spec, ctx));
  return results;
}

async function evaluate(spec: AssertionSpec, ctx: AssertionContext): Promise<AssertionResult> {
  const t = ctx.trajectory;
  const r = (passed: boolean, detail: string): AssertionResult => ({ type: spec.type, passed, detail });

  switch (spec.type) {
    case "output_contains": {
      const needles = toList(spec.value);
      const hay = spec.case_sensitive ? t.finalText : t.finalText.toLowerCase();
      const hits = needles.filter((n) => hay.includes(spec.case_sensitive ? n : n.toLowerCase()));
      const found = spec.mode === "any" ? hits.length > 0 : hits.length === needles.length;
      const passed = spec.negate ? !found : found;
      const missing = needles.filter((n) => !hits.includes(n));
      if (spec.negate) return r(passed, passed ? `absent, as required (0/${needles.length} found)` : `present but must not be: ${hits.join(", ")}`);
      return r(passed, found ? `found ${hits.length}/${needles.length}` : `missing: ${missing.join(", ")}`);
    }
    case "output_regex": {
      const matched = new RegExp(spec.pattern, spec.flags).test(t.finalText);
      const passed = spec.negate ? !matched : matched;
      if (spec.negate) return r(passed, passed ? `no match for /${spec.pattern}/, as required` : `matched /${spec.pattern}/ but must not have`);
      return r(passed, matched ? `matched /${spec.pattern}/` : `no match for /${spec.pattern}/`);
    }
    case "tool_called": {
      const calls = t.toolCalls.filter((c) => c.name === spec.name);
      const want = spec.args_contains;
      const matching = want ? calls.filter((c) => matchesPartial(c.input, want)) : calls;
      const n = matching.length;
      const passed = n >= spec.min_times && (spec.max_times === undefined || n <= spec.max_times);
      const range = spec.max_times === undefined ? `>=${spec.min_times}` : `${spec.min_times}..${spec.max_times}`;
      const argNote = spec.args_contains ? ` with matching args (${calls.length} total)` : "";
      return r(passed, `${spec.name} called ${n}x${argNote}, expected ${range}`);
    }
    case "tool_not_called": {
      const n = t.toolCalls.filter((c) => c.name === spec.name).length;
      return r(n === 0, `${spec.name} called ${n}x, expected 0`);
    }
    case "max_tool_calls": {
      const n = t.toolCalls.length;
      return r(n <= spec.value, `${n} tool calls, limit ${spec.value}`);
    }
    case "state": {
      if (!ctx.session) return r(false, "no server session available for state check");
      const out = await ctx.session.callTool(spec.tool, withTrialDir(spec.args, ctx.session.trialDir) as Record<string, unknown>);
      if (out.isError) return r(false, `state probe ${spec.tool} errored: ${out.text.slice(0, 200)}`);
      const lower = out.text.toLowerCase();
      const missing = toList(spec.contains).filter((s) => !lower.includes(s.toLowerCase()));
      const present = toList(spec.not_contains).filter((s) => lower.includes(s.toLowerCase()));
      const passed = missing.length === 0 && present.length === 0;
      const problems = [missing.length ? `missing: ${missing.join(", ")}` : "", present.length ? `unexpected: ${present.join(", ")}` : ""]
        .filter(Boolean)
        .join("; ");
      return r(passed, passed ? `state ${spec.tool} ok` : `state ${spec.tool} - ${problems}`);
    }
    case "llm": {
      if (!ctx.judge) return r(false, "no judge configured");
      const v = await ctx.judge.grade(ctx.prompt, spec.rubric, t);
      ctx.onJudgeUsage?.(v.inputTokens, v.outputTokens);
      return r(v.passed, v.reasoning);
    }
  }
}

/** State probes may point into the session's sandbox: substitute ${TRIAL_DIR} in every string. */
export function withTrialDir(value: unknown, dir: string | undefined): unknown {
  if (!dir) return value;
  if (typeof value === "string") return value.replaceAll("${TRIAL_DIR}", dir);
  if (Array.isArray(value)) return value.map((v) => withTrialDir(v, dir));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withTrialDir(v, dir)]));
  return value;
}

function toList(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/** Every expected key must match: strings by case-insensitive substring, everything else deep-equal. */
export function matchesPartial(actual: Record<string, unknown>, expected: Record<string, unknown>): boolean {
  return Object.entries(expected).every(([key, want]) => {
    const got = actual[key];
    if (typeof want === "string" && typeof got === "string") return got.toLowerCase().includes(want.toLowerCase());
    if (isPlainObject(want) && isPlainObject(got)) return matchesPartial(got, want);
    return isDeepStrictEqual(got, want);
  });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

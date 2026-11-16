import { describe, expect, it } from "vitest";
import type { Trajectory } from "../src/agent.js";
import { evaluateAll, matchesPartial } from "../src/assertions.js";
import { parseSuite, type AssertionSpec } from "../src/config.js";
import { lintTools } from "../src/lint.js";
import type { McpSession } from "../src/mcp.js";

const trajectory: Trajectory = {
  finalText: "The owner is Dana Reyes.",
  toolCalls: [
    { name: "search_notes", input: { query: "Q3 Planning notes", tag: "planning" }, output: "n1 | Q3 planning", isError: false, durationMs: 3 },
    { name: "get_note", input: { id: "n1" }, output: "...", isError: false, durationMs: 2 },
  ],
  turns: 3,
  stopReason: "end_turn",
  truncated: false,
  inputTokens: 10,
  outputTokens: 5,
  durationMs: 10,
};

// Parse through the real schema so defaults (mode, min_times, flags) are applied as in production.
function specs(...assert: unknown[]): AssertionSpec[] {
  return parseSuite({ server: { command: "x" }, tasks: [{ id: "t", prompt: "p", assert }] }, "/").tasks[0]!.assert;
}

async function check(spec: unknown, session?: McpSession) {
  const [r] = await evaluateAll(specs(spec), { prompt: "p", trajectory, session });
  return r!;
}

describe("deterministic assertions", () => {
  it("output_contains: all vs any, case-insensitive by default", async () => {
    expect((await check({ type: "output_contains", value: ["dana", "reyes"] })).passed).toBe(true);
    expect((await check({ type: "output_contains", value: ["dana", "nobody"] })).passed).toBe(false);
    expect((await check({ type: "output_contains", value: ["dana", "nobody"], mode: "any" })).passed).toBe(true);
    expect((await check({ type: "output_contains", value: "dana", case_sensitive: true })).passed).toBe(false);
  });

  it("output_regex", async () => {
    expect((await check({ type: "output_regex", pattern: "owner is \\w+ reyes" })).passed).toBe(true);
  });

  it("tool_called with count bounds and partial argument match", async () => {
    expect((await check({ type: "tool_called", name: "search_notes" })).passed).toBe(true);
    expect((await check({ type: "tool_called", name: "search_notes", args_contains: { query: "q3 planning" } })).passed).toBe(true);
    expect((await check({ type: "tool_called", name: "search_notes", args_contains: { tag: "legal" } })).passed).toBe(false);
    expect((await check({ type: "tool_called", name: "search_notes", min_times: 2 })).passed).toBe(false);
    expect((await check({ type: "tool_called", name: "delete_note" })).passed).toBe(false);
  });

  it("tool_not_called and max_tool_calls", async () => {
    expect((await check({ type: "tool_not_called", name: "delete_note" })).passed).toBe(true);
    expect((await check({ type: "tool_not_called", name: "get_note" })).passed).toBe(false);
    expect((await check({ type: "max_tool_calls", value: 2 })).passed).toBe(true);
    expect((await check({ type: "max_tool_calls", value: 1 })).passed).toBe(false);
  });

  it("state probes the live server and fails closed without one", async () => {
    const session: McpSession = {
      tools: [],
      callTool: async () => ({ text: "n1 | Q3 planning\nn2 | Offsite agenda", isError: false }),
      close: async () => undefined,
    };
    expect((await check({ type: "state", tool: "search_notes", contains: "offsite agenda" }, session)).passed).toBe(true);
    expect((await check({ type: "state", tool: "search_notes", not_contains: "Q3 planning" }, session)).passed).toBe(false);
    expect((await check({ type: "state", tool: "search_notes", contains: "x" })).passed).toBe(false);
  });

  it("llm fails closed when no judge is configured", async () => {
    expect((await check({ type: "llm", rubric: "anything" })).passed).toBe(false);
  });
});

describe("matchesPartial", () => {
  it("substring-matches strings and deep-matches everything else", () => {
    expect(matchesPartial({ a: "Hello World", n: 3, o: { x: [1, 2] } }, { a: "world", n: 3, o: { x: [1, 2] } })).toBe(true);
    expect(matchesPartial({ n: 3 }, { n: "3" })).toBe(false);
    expect(matchesPartial({}, { missing: "x" })).toBe(false);
  });
});

describe("lintTools", () => {
  it("flags missing descriptions, undocumented params, undeclared required params and bad names", () => {
    const issues = lintTools([
      { name: "good_tool", description: "Searches notes by text and returns matching ids.", inputSchema: { type: "object", properties: { q: { type: "string", description: "query" } } } },
      { name: "bad tool", inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q", "z"] } },
    ]);
    const msgs = issues.filter((i) => i.tool === "bad tool").map((i) => i.message).join("\n");
    expect(issues.filter((i) => i.tool === "good_tool")).toEqual([]);
    expect(msgs).toMatch(/name must match/);
    expect(msgs).toMatch(/no description/);
    expect(msgs).toMatch(/parameter "q" has no description/);
    expect(msgs).toMatch(/required parameter "z"/);
  });
});

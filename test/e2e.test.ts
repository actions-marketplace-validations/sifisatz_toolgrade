import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compareRuns } from "../src/compare.js";
import { loadSuite, type Suite } from "../src/config.js";
import { openSession } from "../src/mcp.js";
import { ScriptedProvider } from "../src/providers/scripted.js";
import { formatMarkdown, formatTerminal } from "../src/report.js";
import { FatalRunError, runSuite } from "../src/runner.js";
import { notesAgent as agent } from "../examples/scripted-agent.js";

const SUITE = join(import.meta.dirname, "..", "examples", "notes-suite.yaml");

async function suiteWith(env: Record<string, string>): Promise<Suite> {
  const suite = await loadSuite(SUITE);
  if ("command" in suite.server) suite.server.env = { ...suite.server.env, ...env };
  return suite;
}

describe("end to end against the real notes MCP server", () => {
  it("isolates trials: each session gets a fresh server", async () => {
    const suite = await suiteWith({});
    const a = await openSession(suite.server);
    const b = await openSession(suite.server);
    try {
      await a.callTool("delete_note", { id: "n3" });
      expect((await a.callTool("get_note", { id: "n3" })).isError).toBe(true);
      expect((await b.callTool("get_note", { id: "n3" })).text).toContain("Vendor contracts");
    } finally {
      await Promise.all([a.close(), b.close()]);
    }
  });


  it("measures lift over the no-tool baseline at task level and passes the gate", async () => {
    const provider = new ScriptedProvider(agent);
    const report = await runSuite(await suiteWith({}), { provider, trials: 2, concurrency: 4 });

    expect(report.toolSurface.names.sort()).toEqual(["create_note", "delete_note", "get_note", "list_tags", "search_notes"]);
    // n is tasks, not trials: trials of one task are correlated.
    expect(report.overall.tools.rate).toMatchObject({ n: 6, rate: 1 });
    expect(report.overall.tools.trials).toEqual({ passed: 12, graded: 12, errors: 0 });
    // Only the arithmetic control task is solvable without tools.
    expect(report.overall.baseline?.rate.rate).toBeCloseTo(1 / 6, 6);
    expect(report.overall.lift?.delta).toBeCloseTo(5 / 6, 6);
    expect(report.overall.liftTasks).toBe(6);
    expect(report.overall.liftSignificance).toBe("better");
    expect(report.gate.passed).toBe(true);

    // The baseline is graded on outcomes only: process assertions are skipped, not failed.
    const baselineOwner = report.trials.find((t) => t.taskId === "find-owner" && t.arm === "baseline")!;
    expect(baselineOwner.skipped).toEqual(["tool_called"]);
    expect(baselineOwner.assertions.map((a) => a.type)).toEqual(["output_contains"]);
    // State assertions ran against the real server and the baseline arm saw an untouched world.
    const baselineDelete = report.trials.find((t) => t.taskId === "delete-note" && t.arm === "baseline")!;
    expect(baselineDelete.assertions.find((a) => a.type === "state")?.passed).toBe(false);
    expect(provider.requests.filter((r) => r.tools.length === 0 && !r.jsonSchema).length).toBeGreaterThan(0);

    expect(report.totalCostUsd).toBeGreaterThan(0);
    expect(report.costIsLowerBound).toBe(false);
    expect(formatTerminal(report)).toContain("Gate passed");
    expect(formatMarkdown(report)).toContain("| **Lift** | **+83pp**");
  });

  it("does not fail a baseline that reaches the right outcome without tools", async () => {
    const knowsAnswer = (req: Parameters<typeof agent>[0]) =>
      req.tools.length === 0 && !req.jsonSchema ? { text: "The owner is Dana Reyes." } : agent(req);
    const report = await runSuite(await suiteWith({}), { provider: new ScriptedProvider(knowsAnswer), trials: 2, filter: "find-owner" });
    expect(report.tasks[0]!.baseline?.rate.rate).toBe(1);
    expect(report.overall.lift?.delta).toBe(0);
  });

  it("catches a degraded tool surface as a significant regression", async () => {
    const good = await runSuite(await suiteWith({}), { provider: new ScriptedProvider(agent), trials: 3 });
    const vague = await runSuite(await suiteWith({ NOTES_SERVER_VAGUE: "1" }), { provider: new ScriptedProvider(agent), trials: 3 });

    // Same agent, worse tools: only create-note and the control task survive.
    expect(vague.overall.tools.rate.rate).toBeCloseTo(2 / 6, 6);
    expect(vague.gate.passed).toBe(false);
    const cmp = compareRuns(good, vague);
    expect(cmp.verdict).toBe("regressed");
    expect(cmp.overall.significance).toBe("worse");
    expect(cmp.tasks.filter((t) => t.significance === "worse").map((t) => t.taskId).sort()).toEqual([
      "delete-note",
      "find-owner",
      "incident-root-cause",
      "summarize-plan",
    ]);
  });

  it("compares only matched tasks when the two runs cover different task sets", async () => {
    const full = await runSuite(await suiteWith({}), { provider: new ScriptedProvider(agent), trials: 1, baseline: false });
    const subset = await runSuite(await suiteWith({}), { provider: new ScriptedProvider(agent), trials: 1, baseline: false, filter: "write" });
    const cmp = compareRuns(full, subset);
    expect(cmp.overall.tasks).toBe(2);
    expect(cmp.unmatched.sort()).toEqual(["find-owner", "incident-root-cause", "no-tool-needed", "summarize-plan"]);
    expect(cmp.verdict).toBe("no_significant_change");
  });

  it("aborts the whole run on configuration-level API errors instead of scoring them", async () => {
    const provider = new ScriptedProvider(() => {
      throw Object.assign(new Error("invalid x-api-key"), { status: 401 });
    });
    await expect(runSuite(await suiteWith({}), { provider, trials: 1, filter: "read" })).rejects.toBeInstanceOf(FatalRunError);
  });

  it("excludes errored trials from pass rates and fails the no_errors gate", async () => {
    const provider = new ScriptedProvider(() => {
      throw Object.assign(new Error("overloaded"), { status: 529 });
    });
    const report = await runSuite(await suiteWith({}), { provider, trials: 1, baseline: false, filter: "control" });
    expect(report.overall.tools.trials).toEqual({ passed: 0, graded: 0, errors: 1 });
    expect(report.overall.tools.rate.n).toBe(0);
    expect(report.gate.checks.find((c) => c.name === "no_errors")?.passed).toBe(false);
    expect(report.gate.checks.find((c) => c.name === "min_pass_rate")?.passed).toBe(false);
  });

  it("treats a 400 after tool output as a trial error and keeps the spend", async () => {
    const provider = new ScriptedProvider((req) => {
      if (req.messages.length > 1) throw Object.assign(new Error("prompt is too long"), { status: 400 });
      return { toolUses: [{ name: "search_notes", input: { query: "q3 planning" } }], usage: { inputTokens: 1000, outputTokens: 50 } };
    });
    const report = await runSuite(await suiteWith({}), { provider, trials: 1, baseline: false, filter: "find-owner" });
    expect(report.trials[0]!.error).toMatch(/too long/);
    expect(report.trials[0]!.usage).toEqual({ inputTokens: 1000, outputTokens: 50 });
    expect(report.totalCostUsd).toBeGreaterThan(0);
    expect(report.costIsLowerBound).toBe(true);
  });

  it("fails min_lift explicitly when no baseline ran", async () => {
    const report = await runSuite(await suiteWith({}), { provider: new ScriptedProvider(agent), trials: 1, baseline: false, filter: "control" });
    expect(report.gate.checks.find((c) => c.name === "min_lift")).toMatchObject({ passed: false });
  });
});

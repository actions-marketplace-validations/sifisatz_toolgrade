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

  it("measures lift over the no-tool baseline and passes the gate", async () => {
    const provider = new ScriptedProvider(agent);
    const report = await runSuite(await suiteWith({}), { provider, trials: 2, concurrency: 4 });

    expect(report.toolSurface.names.sort()).toEqual(["create_note", "delete_note", "get_note", "list_tags", "search_notes"]);
    expect(report.overall.tools.rate).toMatchObject({ passes: 12, n: 12 });
    // Only the arithmetic control task is solvable without tools.
    expect(report.overall.baseline?.rate).toMatchObject({ passes: 2, n: 12 });
    expect(report.overall.lift?.delta).toBeCloseTo(10 / 12, 6);
    expect(report.overall.liftSignificance).toBe("better");
    expect(report.gate.passed).toBe(true);

    // State assertions ran against the real server and the baseline arm saw an untouched world.
    const baselineDelete = report.trials.find((t) => t.taskId === "delete-note" && t.arm === "baseline")!;
    expect(baselineDelete.assertions.find((a) => a.type === "state")?.passed).toBe(false);
    // The baseline never received tool definitions.
    expect(provider.requests.filter((r) => r.tools.length === 0 && !r.jsonSchema).length).toBeGreaterThan(0);

    expect(report.totalCostUsd).toBeGreaterThan(0);
    expect(formatTerminal(report)).toContain("Gate passed");
    expect(formatMarkdown(report)).toContain("| **Lift** | **+83pp**");
  });

  it("catches a degraded tool surface as a significant regression", async () => {
    const good = await runSuite(await suiteWith({}), { provider: new ScriptedProvider(agent), trials: 2 });
    const vague = await runSuite(await suiteWith({ NOTES_SERVER_VAGUE: "1" }), { provider: new ScriptedProvider(agent), trials: 2 });

    // Same agent, worse tools: only create-note and the control task survive.
    expect(vague.overall.tools.rate).toMatchObject({ passes: 4, n: 12 });
    expect(vague.gate.passed).toBe(false);
    const cmp = compareRuns(good, vague);
    expect(cmp.verdict).toBe("regressed");
    expect(cmp.overall.significance).toBe("worse");
  });

  it("aborts the whole run on configuration-level API errors instead of scoring them", async () => {
    const provider = new ScriptedProvider(() => {
      throw Object.assign(new Error("invalid x-api-key"), { status: 401 });
    });
    await expect(runSuite(await suiteWith({}), { provider, trials: 1, filter: "read" })).rejects.toBeInstanceOf(FatalRunError);
  });

  it("records transient errors as failed trials and fails the no_errors gate", async () => {
    const provider = new ScriptedProvider(() => {
      throw Object.assign(new Error("overloaded"), { status: 529 });
    });
    const report = await runSuite(await suiteWith({}), { provider, trials: 1, baseline: false, filter: "control" });
    expect(report.overall.tools.errors).toBe(1);
    expect(report.gate.checks.find((c) => c.name === "no_errors")?.passed).toBe(false);
  });
});

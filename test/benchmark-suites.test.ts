// Validates the public benchmark's checks against the real, pinned servers: for every task, a
// reference solution must pass and the untouched starting state (what a no-tool agent leaves
// behind) must fail. A check that cannot tell the two apart would make the leaderboard lie.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Trajectory } from "../src/agent.js";
import { evaluateAll } from "../src/assertions.js";
import { loadSuite, type Suite } from "../src/config.js";
import { openSession } from "../src/mcp.js";

const ROOT = join(import.meta.dirname, "..", "benchmark");
const installed = existsSync(join(ROOT, "node_modules", "@modelcontextprotocol", "server-filesystem"));

type Step = [tool: string, args: Record<string, unknown>];
type Reference = { answer?: string; steps?: Step[] };

const answerOnly = (finalText: string): Trajectory => ({ finalText, toolCalls: [], turns: 1, stopReason: "end_turn", inputTokens: 0, outputTokens: 0, durationMs: 0 });

async function verdict(suite: Suite, taskId: string, ref: Reference | "untouched") {
  const task = suite.tasks.find((t) => t.id === taskId)!;
  const session = await openSession(suite.server);
  try {
    const fill = (v: unknown): unknown =>
      typeof v === "string" ? v.replaceAll("${TRIAL_DIR}", session.trialDir ?? "") : Array.isArray(v) ? v.map(fill) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v;
    if (ref !== "untouched") {
      for (const [tool, args] of ref.steps ?? []) {
        const out = await session.callTool(tool, fill(args) as Record<string, unknown>);
        expect(out.isError, `${taskId}: ${tool} failed: ${out.text}`).toBe(false);
      }
    }
    const text = ref === "untouched" ? "I don't have access to that information." : (ref.answer ?? "Done.");
    const results = await evaluateAll(task.assert, { prompt: task.prompt, trajectory: answerOnly(text), session });
    return results.every((r) => r.passed);
  } finally {
    await session.close();
  }
}

const REFERENCES: Record<string, Record<string, Reference>> = {
  filesystem: {
    "find-decision": { answer: "They decided to migrate billing to the v2 API by December." },
    "top-region": { answer: "The US had the highest revenue: 205k EUR." },
    "edit-config": { steps: [["edit_file", { path: "${TRIAL_DIR}/src/config.json", edits: [{ oldText: '"debug": true', newText: '"debug": false' }] }]] },
    "append-todo": { steps: [["append_file", { path: "${TRIAL_DIR}/notes/todo.txt", content: "- rotate API keys\n" }]] },
    "create-changelog": {
      steps: [
        ["create_directory", { path: "${TRIAL_DIR}/docs" }],
        ["write_file", { path: "${TRIAL_DIR}/docs/CHANGELOG.md", content: "# 0.2.0\n\n- Add order search\n" }],
      ],
    },
    "rename-report": { steps: [["move_file", { source: "${TRIAL_DIR}/reports/q3.csv", destination: "${TRIAL_DIR}/reports/2026-q3.csv" }]] },
    "no-tool-needed": { answer: "391" },
  },
  memory: {
    "recall-lead": { answer: "Dana Reyes leads it; it ships in December." },
    "remember-person": { steps: [["create_entities", { entities: [{ name: "Priya Nair", entityType: "person", observations: ["Product designer", "Joined the team in November"] }] }]] },
    "relate-people": { steps: [["create_relations", { relations: [{ from: "Sam Okafor", to: "Dana Reyes", relationType: "reports to" }] }]] },
    "update-fact": { steps: [["add_observations", { observations: [{ entityName: "Billing v2", contents: ["Now ships in January"] }] }]] },
    "forget-person": { steps: [["delete_entities", { entityNames: ["Sam Okafor"] }]] },
    "no-tool-needed": { answer: "391" },
  },
  "sequential-thinking": {
    "bat-and-ball": { answer: "The ball costs 5 cents." },
    "weekday-offset": { answer: "It will be Wednesday." },
    "meeting-rooms": { answer: "2" },
    ordering: { answer: "Dan is oldest, so Alice is the second oldest." },
    "discount-chain": { answer: "The final price is 162 euros." },
    "no-tool-needed": { answer: "391" },
  },
};

describe.skipIf(!installed)("public benchmark suites", () => {
  for (const [name, refs] of Object.entries(REFERENCES)) {
    describe(name, async () => {
      const suite = await loadSuite(join(ROOT, "suites", `${name}.yaml`));

      it("has a reference solution for every task", () => {
        expect(suite.tasks.map((t) => t.id).sort()).toEqual(Object.keys(refs).sort());
      });

      for (const [taskId, ref] of Object.entries(refs)) {
        it(`${taskId}: the reference solution passes`, async () => {
          expect(await verdict(suite, taskId, ref)).toBe(true);
        });
        // The control task is solvable without tools by design.
        if (taskId !== "no-tool-needed") {
          it(`${taskId}: the untouched start state fails`, async () => {
            expect(await verdict(suite, taskId, "untouched")).toBe(false);
          });
        }
      }
    });
  }
});

import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateAll } from "../src/assertions.js";
import { parseSuite } from "../src/config.js";
import { openSession } from "../src/mcp.js";

const FIXTURES = join(import.meta.dirname, "fixtures");
// Absolute, because the server runs with its cwd inside the sandbox, where tsx is not resolvable.
const TSX = import.meta.resolve("tsx");

function server(withFixture: boolean) {
  const suite = parseSuite(
    {
      server: {
        command: "node",
        args: ["--import", TSX, join(FIXTURES, "file-server.ts")],
        cwd: "${TRIAL_DIR}",
        ...(withFixture ? { fixture: "sandbox-seed" } : {}),
        env: { MARKER: "dir=${TRIAL_DIR}" },
      },
      tasks: [{ id: "t", prompt: "p", assert: [{ type: "output_contains", value: "x" }] }],
    },
    FIXTURES,
  );
  return suite.server;
}

describe("per-trial sandboxes", () => {
  it("gives every session a private copy of the fixture, runs the server inside it, and removes it on close", async () => {
    const a = await openSession(server(true));
    const b = await openSession(server(true));
    try {
      expect(a.trialDir).toBeDefined();
      expect(a.trialDir).not.toBe(b.trialDir);
      expect((await a.callTool("whereami", {})).text).toBe(a.trialDir);
      expect((await a.callTool("read", { name: "hello.txt" })).text).toContain("hello from the fixture");

      await a.callTool("write", { name: "hello.txt", body: "changed by a" });
      expect((await a.callTool("read", { name: "hello.txt" })).text).toBe("changed by a");
      // The other session, and the fixture itself, are untouched.
      expect((await b.callTool("read", { name: "hello.txt" })).text).toContain("hello from the fixture");
    } finally {
      await a.close();
      await b.close();
    }
    expect(existsSync(a.trialDir!)).toBe(false);
    expect(existsSync(join(FIXTURES, "sandbox-seed", "hello.txt"))).toBe(true);
  });

  it("lets state checks read files inside the session's sandbox via ${TRIAL_DIR}", async () => {
    const s = await openSession(server(true));
    try {
      await s.callTool("write", { name: "out.txt", body: "result: 42" });
      const trajectory = { finalText: "", toolCalls: [], turns: 1, stopReason: "end_turn", inputTokens: 0, outputTokens: 0, durationMs: 0 };
      const [ok] = await evaluateAll([{ type: "state", tool: "read", args: { name: "${TRIAL_DIR}/out.txt" }, contains: "result: 42" }], { prompt: "p", trajectory, session: s });
      expect(ok).toMatchObject({ passed: true });
    } finally {
      await s.close();
    }
  });

  it("creates an empty sandbox when a suite only references ${TRIAL_DIR}", async () => {
    const s = await openSession(server(false));
    try {
      expect((await s.callTool("read", { name: "hello.txt" })).isError).toBe(true);
    } finally {
      await s.close();
    }
  });

  it("uses no sandbox when the suite never asks for one", async () => {
    const suite = parseSuite(
      { server: { command: "node", args: ["--import", TSX, join(FIXTURES, "file-server.ts")] }, tasks: [{ id: "t", prompt: "p", assert: [{ type: "output_contains", value: "x" }] }] },
      FIXTURES,
    );
    const s = await openSession(suite.server);
    try {
      expect(s.trialDir).toBeUndefined();
    } finally {
      await s.close();
    }
  });
});

import { describe, expect, it, vi } from "vitest";
import { parseSuite } from "../src/config.js";
import type { McpSession } from "../src/mcp.js";
import { ScriptedProvider } from "../src/providers/scripted.js";
import { runSuite } from "../src/runner.js";

function stubSession(): McpSession {
  return {
    tools: [],
    callTool: async () => ({ text: "", isError: false }),
    close: async () => undefined,
  };
}

describe("unisolated HTTP state warning", () => {
  it("warns when an HTTP server has state assertions and more than one trial", async () => {
    const suite = parseSuite(
      {
        server: { url: "http://example.invalid/mcp" },
        run: { trials: 2, baseline: false },
        tasks: [{ id: "t", prompt: "p", assert: [{ type: "state", tool: "read", args: {}, contains: "x" }] }],
      },
      import.meta.dirname,
    );
    const provider = new ScriptedProvider(() => ({ text: "x" }));
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      await runSuite(suite, { provider, openSession: async () => stubSession() });
      expect(write.mock.calls.map((c) => String(c[0])).join("")).toMatch(/HTTP MCP server.*state assertions/s);
    } finally {
      write.mockRestore();
    }
  });

  it("does not warn for a single trial", async () => {
    const suite = parseSuite(
      {
        server: { url: "http://example.invalid/mcp" },
        run: { trials: 1, baseline: false },
        tasks: [{ id: "t", prompt: "p", assert: [{ type: "state", tool: "read", args: {}, contains: "x" }] }],
      },
      import.meta.dirname,
    );
    const provider = new ScriptedProvider(() => ({ text: "x" }));
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      await runSuite(suite, { provider, openSession: async () => stubSession() });
      expect(write.mock.calls.length).toBe(0);
    } finally {
      write.mockRestore();
    }
  });

  it("does not warn for a stdio server", async () => {
    const suite = parseSuite(
      {
        server: { command: "node", args: [] },
        run: { trials: 2, baseline: false },
        tasks: [{ id: "t", prompt: "p", assert: [{ type: "state", tool: "read", args: {}, contains: "x" }] }],
      },
      import.meta.dirname,
    );
    const provider = new ScriptedProvider(() => ({ text: "x" }));
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      await runSuite(suite, { provider, openSession: async () => stubSession() });
      expect(write.mock.calls.length).toBe(0);
    } finally {
      write.mockRestore();
    }
  });
});

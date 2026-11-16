import { describe, expect, it } from "vitest";
import { runAgent, toAnthropicTools } from "../src/agent.js";
import type { McpSession } from "../src/mcp.js";
import { ScriptedProvider } from "../src/providers/scripted.js";

const session: McpSession = {
  tools: [{ name: "echo", description: "Echo the input back.", inputSchema: { type: "object", properties: { s: { type: "string" } } } }],
  callTool: async (_name, args) => ({ text: `echo:${String(args.s)}`, isError: false }),
  close: async () => undefined,
};

describe("runAgent", () => {
  it("marks a run that never finishes as truncated at max_turns", async () => {
    const provider = new ScriptedProvider(() => ({ toolUses: [{ name: "echo", input: { s: "again" } }] }));
    const t = await runAgent({ provider, model: "m", prompt: "loop", maxTurns: 3, maxTokens: 1000, session });
    expect(t.truncated).toBe(true);
    expect(t.turns).toBe(3);
    expect(t.toolCalls).toHaveLength(3);
  });

  it("returns hallucinated tool names to the model as errors instead of crashing", async () => {
    let turn = 0;
    const provider = new ScriptedProvider(() => (turn++ === 0 ? { toolUses: [{ name: "nope", input: {} }] } : { text: "ok" }));
    const t = await runAgent({ provider, model: "m", prompt: "x", maxTurns: 5, maxTokens: 1000, session });
    expect(t.toolCalls[0]).toMatchObject({ name: "nope", isError: true });
    expect(t.finalText).toBe("ok");
    const second = provider.requests[1]!.messages.at(-1)!;
    expect(JSON.stringify(second.content)).toContain('"is_error":true');
  });

  it("sends all tool results of a turn back in a single user message", async () => {
    let turn = 0;
    const provider = new ScriptedProvider(() =>
      turn++ === 0 ? { toolUses: [{ name: "echo", input: { s: "a" } }, { name: "echo", input: { s: "b" } }] } : { text: "done" },
    );
    const t = await runAgent({ provider, model: "m", prompt: "x", maxTurns: 5, maxTokens: 1000, session });
    const results = provider.requests[1]!.messages.at(-1)!;
    expect(Array.isArray(results.content) && results.content.length).toBe(2);
    expect(t.inputTokens).toBe(200);
  });

  it("strips $schema from MCP tool schemas before sending them to the model", () => {
    const [tool] = toAnthropicTools([{ name: "t", inputSchema: { type: "object", properties: {}, $schema: "http://json-schema.org/draft-07/schema#" } }]);
    expect(tool!.input_schema).toEqual({ type: "object", properties: {} });
  });

  it("exposes no tools when no session is given (baseline arm)", async () => {
    const provider = new ScriptedProvider(() => ({ text: "hi" }));
    await runAgent({ provider, model: "m", prompt: "x", maxTurns: 2, maxTokens: 1000 });
    expect(provider.requests[0]!.tools).toEqual([]);
  });
});

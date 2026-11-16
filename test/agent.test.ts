import { describe, expect, it } from "vitest";
import { AgentRunError, runAgent, toAnthropicTools, type AgentOptions } from "../src/agent.js";
import type { McpSession } from "../src/mcp.js";
import { ScriptedProvider, type Script } from "../src/providers/scripted.js";

const session: McpSession = {
  tools: [{ name: "echo", description: "Echo the input back.", inputSchema: { type: "object", properties: { s: { type: "string" } } } }],
  callTool: async (_name, args) => ({ text: `echo:${String(args.s)}`, isError: false }),
  close: async () => undefined,
};

function run(script: Script, extra: Partial<AgentOptions> = {}) {
  const provider = new ScriptedProvider(script);
  const result = runAgent({ provider, model: "m", prompt: "x", maxTurns: 5, maxTokens: 1000, maxToolResultChars: 20000, session, ...extra });
  return { provider, result };
}

/** Script from a list of replies, one per turn. */
const turns = (...replies: ReturnType<Script>[]): Script => {
  let i = 0;
  return () => replies[Math.min(i++, replies.length - 1)]!;
};

describe("runAgent", () => {
  it("marks a run that never finishes as incomplete at max_turns", async () => {
    const t = await run(() => ({ toolUses: [{ name: "echo", input: { s: "again" } }] }), { maxTurns: 3 }).result;
    expect(t.incomplete).toBe("max_turns");
    expect(t.turns).toBe(3);
    expect(t.toolCalls).toHaveLength(3);
  });

  it.each(["max_tokens", "refusal", "model_context_window_exceeded"])("treats stop reason %s as incomplete", async (stopReason) => {
    const t = await run(() => ({ text: "The answer is", stopReason })).result;
    expect(t.incomplete).toBe(stopReason);
  });

  it("grades only the last turn's text, not an earlier preamble", async () => {
    const t = await run(turns({ text: "Let me search for Dana Reyes", toolUses: [{ name: "echo", input: { s: "a" } }] }, { text: "" })).result;
    expect(t.incomplete).toBeUndefined();
    expect(t.finalText).toBe("");
  });

  it("returns hallucinated tool names to the model as errors instead of crashing", async () => {
    const { provider, result } = run(turns({ toolUses: [{ name: "nope", input: {} }] }, { text: "ok" }));
    const t = await result;
    expect(t.toolCalls[0]).toMatchObject({ name: "nope", isError: true });
    expect(t.finalText).toBe("ok");
    expect(JSON.stringify(provider.requests[1]!.messages.at(-1)!.content)).toContain('"is_error":true');
  });

  it("sends all tool results of a turn back in a single user message", async () => {
    const { provider, result } = run(turns({ toolUses: [{ name: "echo", input: { s: "a" } }, { name: "echo", input: { s: "b" } }] }, { text: "done" }));
    const t = await result;
    const results = provider.requests[1]!.messages.at(-1)!;
    expect(Array.isArray(results.content) && results.content.length).toBe(2);
    expect(t.inputTokens).toBe(200);
  });

  it("caps oversized tool results sent to the model but records the full output", async () => {
    const big: McpSession = { ...session, callTool: async () => ({ text: "x".repeat(5000), isError: false }) };
    const { provider, result } = run(turns({ toolUses: [{ name: "echo", input: {} }] }, { text: "done" }), { session: big, maxToolResultChars: 100 });
    const t = await result;
    expect(t.toolCalls[0]!.output).toHaveLength(5000);
    const sent = JSON.stringify(provider.requests[1]!.messages.at(-1)!.content);
    expect(sent).toContain("truncated by toolgrade: 4900 more chars");
    expect(sent.length).toBeLessThan(500);
  });

  it("keeps the usage already spent when a later turn fails", async () => {
    let i = 0;
    const err = await run(() => {
      if (i++ === 0) return { toolUses: [{ name: "echo", input: { s: "a" } }], usage: { inputTokens: 70, outputTokens: 9 } };
      throw Object.assign(new Error("prompt is too long"), { status: 400 });
    }).result.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AgentRunError);
    expect((err as AgentRunError).usage).toEqual({ inputTokens: 70, outputTokens: 9 });
    expect((err as AgentRunError).turn).toBe(2);
  });

  it("strips $schema from MCP tool schemas before sending them to the model", () => {
    const [tool] = toAnthropicTools([{ name: "t", inputSchema: { type: "object", properties: {}, $schema: "http://json-schema.org/draft-07/schema#" } }]);
    expect(tool!.input_schema).toEqual({ type: "object", properties: {} });
  });

  it("exposes no tools when no session is given (baseline arm)", async () => {
    const { provider, result } = run(() => ({ text: "hi" }), { session: undefined });
    await result;
    expect(provider.requests[0]!.tools).toEqual([]);
  });
});

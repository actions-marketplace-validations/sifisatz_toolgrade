import { describe, expect, it } from "vitest";
import { runAgent } from "../src/agent.js";
import type { McpSession } from "../src/mcp.js";
import { OpenAICompatibleProvider, stripThinking, toChatMessages } from "../src/providers/openai.js";
import type { TurnRequest } from "../src/providers/types.js";

type Reply = { status?: number; body: unknown } | Error;

/** Fake fetch that records request bodies and plays back replies in order. */
function fakeFetch(...replies: Reply[]) {
  const bodies: Array<Record<string, unknown>> = [];
  let i = 0;
  const fn = (async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body) as Record<string, unknown>);
    const r = replies[Math.min(i++, replies.length - 1)]!;
    if (r instanceof Error) throw r;
    return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { fn, bodies };
}

const ok = (message: Record<string, unknown>, finish_reason = "stop") => ({
  body: { choices: [{ message, finish_reason }], usage: { prompt_tokens: 30, completion_tokens: 5 } },
});

const provider = (fn: typeof fetch) => new OpenAICompatibleProvider({ baseUrl: "http://localhost:11434/v1/", fetch: fn, maxRetries: 2 });
const req: TurnRequest = { model: "qwen3:8b", messages: [{ role: "user", content: "hi" }], tools: [], maxTokens: 100 };

describe("OpenAICompatibleProvider", () => {
  it("maps tool calls, usage and stop reasons, even when finish_reason says stop", async () => {
    const f = fakeFetch(ok({ content: "<think>plan</think>Searching.", tool_calls: [{ id: "c1", type: "function", function: { name: "search_notes", arguments: '{"query":"q3"}' } }] }));
    const res = await provider(f.fn).turn(req);
    expect(res.stopReason).toBe("tool_use");
    expect(res.text).toBe("Searching.");
    expect(res.toolUses).toEqual([{ id: "c1", name: "search_notes", input: { query: "q3" } }]);
    expect(res.usage).toEqual({ inputTokens: 30, outputTokens: 5 });
  });

  it.each([
    ["stop", "end_turn"],
    ["length", "max_tokens"],
    ["content_filter", "refusal"],
  ])("maps finish_reason %s to %s", async (finish, stop) => {
    expect((await provider(fakeFetch(ok({ content: "x" }, finish)).fn).turn(req)).stopReason).toBe(stop);
  });

  it("passes invalid tool arguments through so the server can reject them", async () => {
    const f = fakeFetch(ok({ content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "t", arguments: "{oops" } }] }));
    expect((await provider(f.fn).turn(req)).toolUses[0]!.input).toEqual({ _invalid_arguments: "{oops" });
  });

  it("sends tools as functions and the judge schema as response_format", async () => {
    const f = fakeFetch(ok({ content: "{}" }));
    await provider(f.fn).turn({
      ...req,
      system: "be strict",
      tools: [{ name: "t", description: "d", input_schema: { type: "object", properties: {} } }],
      jsonSchema: { type: "object" },
    });
    const body = f.bodies[0]!;
    expect(body.tools).toEqual([{ type: "function", function: { name: "t", description: "d", parameters: { type: "object", properties: {} } } }]);
    expect(body.response_format).toMatchObject({ type: "json_schema", json_schema: { schema: { type: "object" } } });
    expect((body.messages as unknown[])[0]).toEqual({ role: "system", content: "be strict" });
  });

  it("retries 5xx and then succeeds", async () => {
    const f = fakeFetch({ status: 503, body: "busy" }, ok({ content: "fine" }));
    expect((await provider(f.fn).turn(req)).text).toBe("fine");
    expect(f.bodies).toHaveLength(2);
  });

  it("surfaces 4xx with status so the runner can classify it", async () => {
    const err = await provider(fakeFetch({ status: 404, body: "model not found" }).fn).turn(req).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 404 });
    expect(String(err)).toMatch(/model not found/);
  });

  it("marks an unreachable endpoint fatal after retries", async () => {
    const f = fakeFetch(new TypeError("fetch failed"));
    const err = await provider(f.fn).turn(req).catch((e: unknown) => e);
    expect(err).toMatchObject({ fatal: true });
    expect(String(err)).toMatch(/is the server running/);
    expect(f.bodies).toHaveLength(3);
  });
});

describe("toChatMessages", () => {
  it("translates an Anthropic-shaped tool loop into OpenAI chat messages", () => {
    const msgs = toChatMessages({
      ...req,
      messages: [
        { role: "user", content: "find it" },
        { role: "assistant", content: [{ type: "text", text: "ok" }, { type: "tool_use", id: "c1", name: "search", input: { q: "x" } }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "c1", content: "nothing", is_error: true }] },
      ],
    });
    expect(msgs).toEqual([
      { role: "user", content: "find it" },
      { role: "assistant", content: "ok", tool_calls: [{ id: "c1", type: "function", function: { name: "search", arguments: '{"q":"x"}' } }] },
      { role: "tool", tool_call_id: "c1", content: "Error: nothing" },
    ]);
  });

  it("drops inline reasoning", () => {
    expect(stripThinking("<think>a\nb</think>\n\nanswer")).toBe("answer");
  });
});

describe("full agent loop over the OpenAI-compatible wire format", () => {
  it("calls the MCP tool and feeds the result back as a tool message", async () => {
    const session: McpSession = {
      tools: [{ name: "lookup", description: "Look up an owner.", inputSchema: { type: "object", properties: { q: { type: "string" } } } }],
      callTool: async (_n, args) => ({ text: `owner of ${String(args.q)}: Dana Reyes`, isError: false }),
      close: async () => undefined,
    };
    const f = fakeFetch(
      ok({ content: "", tool_calls: [{ id: "c1", type: "function", function: { name: "lookup", arguments: '{"q":"q3"}' } }] }, "tool_calls"),
      ok({ content: "Dana Reyes owns it." }),
    );
    const t = await runAgent({ provider: provider(f.fn), model: "qwen3:8b", prompt: "who owns q3?", maxTurns: 5, maxTokens: 500, maxToolResultChars: 20000, session });
    expect(t.finalText).toBe("Dana Reyes owns it.");
    expect(t.incomplete).toBeUndefined();
    expect((f.bodies[1]!.messages as unknown[]).at(-1)).toEqual({ role: "tool", tool_call_id: "c1", content: "owner of q3: Dana Reyes" });
  });
});

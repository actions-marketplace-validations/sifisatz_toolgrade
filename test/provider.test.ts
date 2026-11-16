import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { AnthropicProvider } from "../src/providers/anthropic.js";

function providerThrowing(err: unknown) {
  const client = { messages: { create: async () => Promise.reject(err) } } as unknown as Anthropic;
  return new AnthropicProvider(client);
}

const req = { model: "m", messages: [{ role: "user" as const, content: "x" }], tools: [], maxTokens: 10 };

describe("AnthropicProvider error classification", () => {
  it("marks client-side failures such as missing credentials as fatal", async () => {
    await expect(providerThrowing(new Error("Could not resolve authentication method")).turn(req)).rejects.toMatchObject({ fatal: true });
  });

  it("leaves connection errors retryable", async () => {
    const err = new Anthropic.APIConnectionError({ message: "socket hang up" });
    const caught = await providerThrowing(err).turn(req).catch((e: unknown) => e);
    expect(caught).toBe(err);
    expect((caught as { fatal?: boolean }).fatal).toBeUndefined();
  });

  it("maps a real response shape: text, tool uses, usage, effort and JSON schema", async () => {
    let sent: Record<string, unknown> = {};
    const client = {
      messages: {
        create: async (params: Record<string, unknown>) => {
          sent = params;
          return {
            content: [
              { type: "thinking", thinking: "", signature: "sig" },
              { type: "text", text: "checking" },
              { type: "tool_use", id: "toolu_1", name: "search_notes", input: { query: "q3" } },
            ],
            stop_reason: "tool_use",
            usage: { input_tokens: 42, output_tokens: 7 },
          };
        },
      },
    } as unknown as Anthropic;
    const res = await new AnthropicProvider(client).turn({ ...req, effort: "low", jsonSchema: { type: "object" } });
    expect(sent.output_config).toEqual({ effort: "low", format: { type: "json_schema", schema: { type: "object" } } });
    expect("tools" in sent).toBe(false);
    expect(res.text).toBe("checking");
    expect(res.toolUses).toEqual([{ id: "toolu_1", name: "search_notes", input: { query: "q3" } }]);
    expect(res.usage).toEqual({ inputTokens: 42, outputTokens: 7 });
    // Thinking blocks must round-trip verbatim in the assistant turn.
    expect(res.content[0]).toMatchObject({ type: "thinking", signature: "sig" });
  });
});

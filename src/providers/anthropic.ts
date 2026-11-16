import Anthropic from "@anthropic-ai/sdk";
import type { ModelProvider, ToolUse, TurnRequest, TurnResponse } from "./types.js";

export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;

  constructor(client: Anthropic = new Anthropic()) {
    this.client = client;
  }

  async turn(req: TurnRequest): Promise<TurnResponse> {
    const outputConfig: Anthropic.OutputConfig = {};
    if (req.effort) outputConfig.effort = req.effort;
    if (req.jsonSchema) outputConfig.format = { type: "json_schema", schema: req.jsonSchema };

    let message: Anthropic.Message;
    try {
      message = await this.client.messages.create({
        model: req.model,
        max_tokens: req.maxTokens,
        messages: req.messages,
        ...(req.system ? { system: req.system } : {}),
        ...(req.tools.length > 0 ? { tools: req.tools } : {}),
        ...(Object.keys(outputConfig).length > 0 ? { output_config: outputConfig } : {}),
      });
    } catch (err) {
      // Non-APIErrors failed client-side before any request (e.g. no credentials: the SDK throws a
      // plain Error), so they repeat on every trial. Connection errors are APIErrors and stay retryable.
      if (!(err instanceof Anthropic.APIError)) {
        throw Object.assign(err instanceof Error ? err : new Error(String(err)), { fatal: true });
      }
      throw err;
    }

    const toolUses: ToolUse[] = [];
    const texts: string[] = [];
    for (const block of message.content) {
      if (block.type === "text") texts.push(block.text);
      if (block.type === "tool_use") {
        toolUses.push({ id: block.id, name: block.name, input: (block.input ?? {}) as Record<string, unknown> });
      }
    }

    return {
      content: message.content as Anthropic.ContentBlockParam[],
      text: texts.join("\n"),
      toolUses,
      stopReason: message.stop_reason ?? "unknown",
      usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
    };
  }
}

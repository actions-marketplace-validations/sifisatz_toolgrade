import type Anthropic from "@anthropic-ai/sdk";
import type { McpSession, McpTool } from "./mcp.js";
import type { Effort, ModelProvider } from "./providers/types.js";

export interface ToolCallRecord {
  name: string;
  input: Record<string, unknown>;
  output: string;
  isError: boolean;
  durationMs: number;
}

export interface Trajectory {
  finalText: string;
  toolCalls: ToolCallRecord[];
  turns: number;
  stopReason: string;
  /** True when the loop hit max_turns before the model finished. */
  truncated: boolean;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export interface AgentOptions {
  provider: ModelProvider;
  model: string;
  prompt: string;
  system?: string;
  maxTurns: number;
  maxTokens: number;
  effort?: Effort;
  /** Tools are exposed only when a session is given; the baseline arm passes none. */
  session?: McpSession;
}

export function toAnthropicTools(tools: McpTool[]): Anthropic.Tool[] {
  return tools.map((t) => {
    // `$schema` is emitted by MCP SDKs but means nothing to the model; drop it.
    const { $schema: _ignored, ...schema } = t.inputSchema;
    return {
      name: t.name,
      description: t.description ?? "",
      input_schema: { type: "object", ...schema } as Anthropic.Tool.InputSchema,
    };
  });
}

export async function runAgent(opts: AgentOptions): Promise<Trajectory> {
  const started = Date.now();
  const tools = opts.session ? toAnthropicTools(opts.session.tools) : [];
  const known = new Set(tools.map((t) => t.name));
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.prompt }];
  const toolCalls: ToolCallRecord[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let finalText = "";
  let stopReason = "unknown";

  for (let turn = 1; turn <= opts.maxTurns; turn++) {
    const res = await opts.provider.turn({
      model: opts.model,
      system: opts.system,
      messages,
      tools,
      maxTokens: opts.maxTokens,
      effort: opts.effort,
    });
    inputTokens += res.usage.inputTokens;
    outputTokens += res.usage.outputTokens;
    stopReason = res.stopReason;
    if (res.text) finalText = res.text;
    messages.push({ role: "assistant", content: res.content });

    if (res.stopReason === "pause_turn") continue;
    if (res.stopReason !== "tool_use" || res.toolUses.length === 0) {
      return { finalText, toolCalls, turns: turn, stopReason, truncated: false, inputTokens, outputTokens, durationMs: Date.now() - started };
    }

    // Sequential on purpose: servers under test are rarely safe for concurrent mutation.
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const use of res.toolUses) {
      const t0 = Date.now();
      const outcome =
        opts.session && known.has(use.name)
          ? await opts.session.callTool(use.name, use.input)
          : { text: `Unknown tool: ${use.name}`, isError: true };
      toolCalls.push({ name: use.name, input: use.input, output: outcome.text, isError: outcome.isError, durationMs: Date.now() - t0 });
      results.push({ type: "tool_result", tool_use_id: use.id, content: outcome.text, ...(outcome.isError ? { is_error: true } : {}) });
    }
    messages.push({ role: "user", content: results });
  }

  return { finalText, toolCalls, turns: opts.maxTurns, stopReason, truncated: true, inputTokens, outputTokens, durationMs: Date.now() - started };
}

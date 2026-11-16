import type Anthropic from "@anthropic-ai/sdk";
import type { ModelProvider, ToolUse, TurnRequest, TurnResponse } from "./types.js";

export interface ScriptedReply {
  text?: string;
  toolUses?: Array<Omit<ToolUse, "id">>;
  usage?: { inputTokens: number; outputTokens: number };
  /** Defaults to tool_use when tools are requested, else end_turn. */
  stopReason?: string;
}

export type Script = (req: TurnRequest) => ScriptedReply;

/** Deterministic provider for tests and offline demos: a function decides each reply. */
export class ScriptedProvider implements ModelProvider {
  readonly name = "scripted";
  readonly requests: TurnRequest[] = [];
  private seq = 0;

  constructor(private readonly script: Script) {}

  async turn(req: TurnRequest): Promise<TurnResponse> {
    this.requests.push(structuredClone(req));
    const reply = this.script(req);
    const toolUses = (reply.toolUses ?? []).map((t) => ({ ...t, id: `toolu_${++this.seq}` }));
    const content: Anthropic.ContentBlockParam[] = [];
    if (reply.text) content.push({ type: "text", text: reply.text });
    for (const t of toolUses) content.push({ type: "tool_use", id: t.id, name: t.name, input: t.input });
    return {
      content,
      text: reply.text ?? "",
      toolUses,
      stopReason: reply.stopReason ?? (toolUses.length > 0 ? "tool_use" : "end_turn"),
      usage: reply.usage ?? { inputTokens: 100, outputTokens: 20 },
    };
  }
}

/** Last text the user role sent: the task prompt or the latest tool results flattened. */
export function lastUserText(req: TurnRequest): string {
  const last = req.messages[req.messages.length - 1];
  if (!last || last.role !== "user") return "";
  if (typeof last.content === "string") return last.content;
  return last.content
    .map((b) => {
      if (b.type === "text") return b.text;
      if (b.type === "tool_result") {
        return typeof b.content === "string"
          ? b.content
          : (b.content ?? []).map((c) => (c.type === "text" ? c.text : "")).join("\n");
      }
      return "";
    })
    .join("\n");
}

export function firstUserText(req: TurnRequest): string {
  const first = req.messages[0];
  return first && typeof first.content === "string" ? first.content : "";
}

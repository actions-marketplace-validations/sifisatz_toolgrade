import type Anthropic from "@anthropic-ai/sdk";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface TurnRequest {
  model: string;
  system?: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  maxTokens: number;
  effort?: Effort;
  jsonSchema?: Record<string, unknown>;
}

export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface TurnResponse {
  /** Appended verbatim as the assistant turn, so thinking blocks round-trip unchanged. */
  content: Anthropic.ContentBlockParam[];
  text: string;
  toolUses: ToolUse[];
  stopReason: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface ModelProvider {
  readonly name: string;
  turn(req: TurnRequest): Promise<TurnResponse>;
}

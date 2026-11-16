import type Anthropic from "@anthropic-ai/sdk";
import type { ModelProvider, ToolUse, TurnRequest, TurnResponse } from "./types.js";

// Wire types for the OpenAI-compatible /chat/completions API (OpenAI, Ollama, Gemini, Groq, ...).
interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ChatToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

interface ChatResponse {
  choices?: Array<{ message?: { content?: string | null; tool_calls?: ChatToolCall[] }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export interface OpenAICompatibleOptions {
  /** e.g. http://localhost:11434/v1 for Ollama, https://api.openai.com/v1 for OpenAI. */
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
}

const FINISH_TO_STOP: Record<string, string> = {
  stop: "end_turn",
  tool_calls: "tool_use",
  function_call: "tool_use",
  length: "max_tokens",
  content_filter: "refusal",
};

export class OpenAICompatibleProvider implements ModelProvider {
  readonly name = "openai-compatible";
  private readonly url: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly opts: OpenAICompatibleOptions) {
    this.url = `${opts.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    this.fetchFn = opts.fetch ?? fetch;
  }

  async turn(req: TurnRequest): Promise<TurnResponse> {
    const body: Record<string, unknown> = {
      model: req.model,
      messages: toChatMessages(req),
      max_tokens: req.maxTokens,
      stream: false,
    };
    if (req.tools.length > 0) body.tools = req.tools.map(toChatTool);
    if (req.jsonSchema) body.response_format = { type: "json_schema", json_schema: { name: "verdict", schema: req.jsonSchema, strict: true } };

    const data = await this.post(body);
    const choice = data.choices?.[0];
    if (!choice?.message) throw new Error(`malformed response from ${this.url}: no choices[0].message`);

    const text = stripThinking(choice.message.content ?? "");
    const toolUses: ToolUse[] = (choice.message.tool_calls ?? []).map((c, i) => ({
      id: c.id || `call_${i}`,
      name: c.function.name,
      input: parseArguments(c.function.arguments),
    }));
    const content: Anthropic.ContentBlockParam[] = [];
    if (text) content.push({ type: "text", text });
    for (const t of toolUses) content.push({ type: "tool_use", id: t.id, name: t.name, input: t.input });

    // Several local servers report finish_reason "stop" even when they emitted tool calls.
    const stopReason = toolUses.length > 0 ? "tool_use" : (FINISH_TO_STOP[choice.finish_reason ?? "stop"] ?? choice.finish_reason ?? "end_turn");
    return {
      content,
      text,
      toolUses,
      stopReason,
      usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 },
    };
  }

  private async post(body: Record<string, unknown>): Promise<ChatResponse> {
    const maxRetries = this.opts.maxRetries ?? 2;
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.fetchFn(this.url, {
          method: "POST",
          headers: { "content-type": "application/json", ...(this.opts.apiKey ? { authorization: `Bearer ${this.opts.apiKey}` } : {}) },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.opts.timeoutMs ?? 300_000),
        });
      } catch (err) {
        if (attempt < maxRetries) {
          await sleep(backoff(attempt));
          continue;
        }
        // An endpoint we cannot reach at all will not come back for the next trial either.
        const reason = err instanceof Error ? err.message : String(err);
        throw Object.assign(new Error(`cannot reach ${this.url} (${reason}) - is the server running?`), { fatal: true });
      }
      if (res.ok) return (await res.json()) as ChatResponse;
      const detail = (await res.text()).slice(0, 500);
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        await sleep(backoff(attempt));
        continue;
      }
      throw Object.assign(new Error(`${res.status} from ${this.url}: ${detail}`), { status: res.status });
    }
  }
}

export function toChatMessages(req: TurnRequest): ChatMessage[] {
  const out: ChatMessage[] = [];
  if (req.system) out.push({ role: "system", content: req.system });
  for (const m of req.messages) {
    if (typeof m.content === "string") {
      out.push(m.role === "user" ? { role: "user", content: m.content } : { role: "assistant", content: m.content });
      continue;
    }
    if (m.role === "assistant") {
      const text = m.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
      const calls: ChatToolCall[] = m.content.flatMap((b) =>
        b.type === "tool_use" ? [{ id: b.id, type: "function" as const, function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }] : [],
      );
      out.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
      continue;
    }
    const texts: string[] = [];
    for (const b of m.content) {
      if (b.type === "tool_result") {
        const result = typeof b.content === "string" ? b.content : (b.content ?? []).map((c) => (c.type === "text" ? c.text : "")).join("\n");
        out.push({ role: "tool", tool_call_id: b.tool_use_id, content: b.is_error ? `Error: ${result}` : result });
      } else if (b.type === "text") {
        texts.push(b.text);
      }
    }
    if (texts.length) out.push({ role: "user", content: texts.join("\n") });
  }
  return out;
}

function toChatTool(t: Anthropic.Tool) {
  return { type: "function", function: { name: t.name, description: t.description ?? "", parameters: t.input_schema } };
}

/** Invalid JSON is passed through so the server rejects it and the model sees the error, as with a real bad call. */
function parseArguments(raw: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(raw || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : { _invalid_arguments: raw };
  } catch {
    return { _invalid_arguments: raw };
  }
}

/** Reasoning models served this way often inline their chain of thought; it is not the answer. */
export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

const backoff = (attempt: number) => 500 * 2 ** attempt;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

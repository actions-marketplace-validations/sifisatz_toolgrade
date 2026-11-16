import type { Trajectory } from "./agent.js";
import type { ModelProvider } from "./providers/types.js";

export interface JudgeVerdict {
  passed: boolean;
  reasoning: string;
  inputTokens: number;
  outputTokens: number;
}

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    reasoning: { type: "string" },
    passed: { type: "boolean" },
  },
  required: ["reasoning", "passed"],
  additionalProperties: false,
};

const SYSTEM = `You grade whether an AI agent accomplished a task. You see the task, a rubric, the tools the agent called with their results, and the agent's final answer.
Grade against the rubric only. Judge what the agent actually did and what the tool results show, not what the agent claims. If the final answer asserts something the tool results do not support, that is a fail.
Write your reasoning first, then the verdict.`;

const MAX_RESULT_CHARS = 1500;

export class LlmJudge {
  constructor(
    private readonly provider: ModelProvider,
    private readonly model: string,
  ) {}

  async grade(task: string, rubric: string, t: Trajectory): Promise<JudgeVerdict> {
    const calls = t.toolCalls.length
      ? t.toolCalls
          .map((c, i) => `${i + 1}. ${c.name}(${JSON.stringify(c.input)})${c.isError ? " [error]" : ""}\n   -> ${truncate(c.output)}`)
          .join("\n")
      : "(no tool calls)";
    const prompt = `<task>\n${task}\n</task>\n\n<rubric>\n${rubric}\n</rubric>\n\n<tool_calls>\n${calls}\n</tool_calls>\n\n<final_answer>\n${t.finalText || "(empty)"}\n</final_answer>`;

    const res = await this.provider.turn({
      model: this.model,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
      tools: [],
      maxTokens: 2000,
      jsonSchema: VERDICT_SCHEMA,
    });
    const usage = { inputTokens: res.usage.inputTokens, outputTokens: res.usage.outputTokens };
    try {
      const parsed = JSON.parse(res.text) as { passed?: unknown; reasoning?: unknown };
      if (typeof parsed.passed !== "boolean") throw new Error("missing passed");
      return { passed: parsed.passed, reasoning: String(parsed.reasoning ?? ""), ...usage };
    } catch {
      return { passed: false, reasoning: `judge returned an unparseable verdict: ${truncate(res.text, 200)}`, ...usage };
    }
  }
}

function truncate(s: string, max = MAX_RESULT_CHARS): string {
  return s.length > max ? `${s.slice(0, max)}... [${s.length - max} more chars]` : s;
}

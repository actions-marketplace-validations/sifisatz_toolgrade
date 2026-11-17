export interface Price {
  /** USD per million input tokens. */
  input: number;
  /** USD per million output tokens. */
  output: number;
}

// First-party API list prices, verified against each vendor's own pricing page on 2026-11-17;
// override per suite via `pricing:` when rates change or differ. Anthropic is first-class
// (--provider anthropic); OpenAI and Gemini are reachable through --provider openai, which talks
// to any OpenAI-compatible endpoint (OpenAI's own API, Google's OpenAI-compatible endpoint, Groq,
// a local Ollama server...) - this file cannot cover every such endpoint, only the hosted,
// publicly-priced ones worth a default. A truly local model (Ollama, etc.) has no API bill at
// all; price it at $0 with `--local-model` or the suite's own `pricing:` override instead of
// expecting it here.
export const DEFAULT_PRICES: Record<string, Price> = {
  // --- Anthropic (platform.claude.com/docs/en/about-claude/pricing) ---
  "claude-fable-5-2": { input: 8, output: 40 },
  "claude-mythos-5-2": { input: 8, output: 40 },
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-opus-4-5": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  // Priced here at its <=100k-token-prompt tier; prompts over 100k tokens cost 5x on this model.
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-haiku-4-5": { input: 1, output: 5 },

  // --- OpenAI (developers.openai.com/api/docs/pricing) ---
  "gpt-6.2-astra": { input: 8, output: 40 },
  "gpt-6.2-sol": { input: 2, output: 10 },
  "gpt-6-astra": { input: 10, output: 50 },
  "gpt-6.1-sol": { input: 2, output: 10 },
  "gpt-6.1-terra": { input: 1, output: 5 },
  "gpt-6-luna": { input: 0.1, output: 0.5 },
  "gpt-6-sol": { input: 2, output: 10 },
  "gpt-5.6-sol": { input: 4, output: 20 },
  "gpt-5.6-terra": { input: 2, output: 12 },
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-5.5": { input: 5, output: 30 },
  "gpt-5.4": { input: 2.5, output: 15 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, output: 1.25 },
  "gpt-5.2": { input: 1.75, output: 14 },
  "gpt-5.1": { input: 1.25, output: 10 },
  "gpt-5": { input: 1.25, output: 10 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  o3: { input: 2, output: 8 },

  // --- Gemini, via its OpenAI-compatible endpoint (aistudio.google.com/docs/pricing) ---
  "gemini-4-carbon": { input: 2, output: 10 },
  "gemini-4-argon": { input: 2, output: 10 },
  "gemini-4-hydrogen": { input: 1.5, output: 7.5 },
  "gemini-3.8-flash": { input: 0.75, output: 3.75 },
  "gemini-3.6-flash": { input: 0.75, output: 3.75 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.1-pro-preview": { input: 2, output: 12 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "gemini-3-flash-preview": { input: 0.5, output: 3 },
  // Deprecated 2026-12-01 (auto-reroutes to a newer model after that), still billable today.
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
};

export class CostModel {
  private readonly prices: Record<string, Price>;
  readonly unpriced = new Set<string>();

  constructor(overrides: Record<string, Price> = {}) {
    this.prices = { ...DEFAULT_PRICES, ...overrides };
  }

  /** Returns null for models without a known price, so reports never invent a number. */
  cost(model: string, inputTokens: number, outputTokens: number): number | null {
    const p = this.prices[model];
    if (!p) {
      this.unpriced.add(model);
      return null;
    }
    return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
  }
}

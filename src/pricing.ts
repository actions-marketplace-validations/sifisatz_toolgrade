export interface Price {
  /** USD per million input tokens. */
  input: number;
  /** USD per million output tokens. */
  output: number;
}

// First-party API list prices; override per suite via `pricing:` when rates change or differ.
export const DEFAULT_PRICES: Record<string, Price> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
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

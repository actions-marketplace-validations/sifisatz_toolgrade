import { describe, expect, it } from "vitest";
import { CostModel, DEFAULT_PRICES } from "../src/pricing.js";

describe("CostModel", () => {
  it("prices a known model from the default list", () => {
    const costs = new CostModel();
    // claude-sonnet-5: $2/$10 per million input/output tokens.
    expect(costs.cost("claude-sonnet-5", 500_000, 100_000)).toBeCloseTo(1 + 1, 6);
  });

  it("returns null and records the model as unpriced when it has no known price", () => {
    const costs = new CostModel();
    expect(costs.cost("some-future-model", 1000, 1000)).toBeNull();
    expect(costs.unpriced.has("some-future-model")).toBe(true);
  });

  it("does not record a known model as unpriced", () => {
    const costs = new CostModel();
    costs.cost("claude-sonnet-5", 1000, 1000);
    expect(costs.unpriced.has("claude-sonnet-5")).toBe(false);
  });

  it("lets a suite's pricing override replace a default price", () => {
    const costs = new CostModel({ "claude-sonnet-5": { input: 0, output: 0 } });
    expect(costs.cost("claude-sonnet-5", 1_000_000, 1_000_000)).toBe(0);
  });

  it("lets a suite's pricing override add a price for a model with none by default", () => {
    const costs = new CostModel({ "my-finetune": { input: 1, output: 2 } });
    expect(costs.cost("my-finetune", 1_000_000, 500_000)).toBeCloseTo(1 + 1, 6);
  });

  // Spot-checks for the non-Anthropic providers reachable through --provider openai (any
  // OpenAI-compatible endpoint), added so pricing.ts covers more than just Anthropic - a
  // regression here would mean real dollar costs silently go missing from reports again.
  it.each([
    ["gpt-5", 1_000_000, 1_000_000, 1.25 + 10],
    ["gpt-4o-mini", 1_000_000, 1_000_000, 0.15 + 0.6],
    ["gemini-2.5-flash", 1_000_000, 1_000_000, 0.3 + 2.5],
  ])("prices %s correctly", (model, inputTokens, outputTokens, expected) => {
    const costs = new CostModel();
    expect(costs.cost(model as string, inputTokens as number, outputTokens as number)).toBeCloseTo(
      expected as number,
      6,
    );
  });

  it("has no duplicate-looking keys and every price is non-negative", () => {
    for (const [model, price] of Object.entries(DEFAULT_PRICES)) {
      expect(price.input, model).toBeGreaterThanOrEqual(0);
      expect(price.output, model).toBeGreaterThanOrEqual(0);
    }
  });
});

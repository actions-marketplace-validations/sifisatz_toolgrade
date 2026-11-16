import { describe, expect, it } from "vitest";
import { difference, rate, significance, wilson } from "../src/stats.js";

describe("wilson", () => {
  it("matches reference values", () => {
    const zero = wilson(0, 10);
    expect(zero.low).toBe(0);
    expect(zero.high).toBeCloseTo(0.2775, 3);
    const half = wilson(5, 10);
    expect(half.low).toBeCloseTo(0.2366, 3);
    expect(half.high).toBeCloseTo(0.7634, 3);
  });

  it("is the whole unit interval with no data", () => {
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 });
  });
});

describe("difference (Newcombe hybrid score)", () => {
  // Newcombe (1998), Statistics in Medicine 17:873, example (a): 56/70 vs 48/80.
  it("matches the published worked example", () => {
    const d = difference(rate(56, 70), rate(48, 80));
    expect(d.delta).toBeCloseTo(0.2, 6);
    expect(d.low).toBeCloseTo(0.0524, 3);
    expect(d.high).toBeCloseTo(0.3339, 3);
    expect(significance(d)).toBe("better");
  });

  it("calls small samples inconclusive rather than guessing", () => {
    const d = difference(rate(3, 3), rate(1, 3));
    expect(d.delta).toBeCloseTo(0.667, 3);
    expect(significance(d)).toBe("not_significant");
  });

  it("detects a clear drop", () => {
    expect(significance(difference(rate(2, 20), rate(18, 20)))).toBe("worse");
  });
});

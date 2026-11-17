import { describe, expect, it } from "vitest";
import { fingerprintSurface, fingerprintTools } from "../src/fingerprint.js";
import type { McpTool } from "../src/mcp.js";

function tool(overrides: Partial<McpTool> & { name: string }): McpTool {
  return { description: "desc", inputSchema: { type: "object" }, ...overrides };
}

describe("fingerprintTools", () => {
  it("is stable regardless of input order", () => {
    const a = fingerprintTools([tool({ name: "b" }), tool({ name: "a" })]);
    const b = fingerprintTools([tool({ name: "a" }), tool({ name: "b" })]);
    expect(a).toEqual(b);
    expect(a.map((t) => t.name)).toEqual(["a", "b"]);
  });

  it("gives two tools with identical name/description/schema the same hash", () => {
    const [a] = fingerprintTools([tool({ name: "x" })]);
    const [b] = fingerprintTools([tool({ name: "x" })]);
    expect(a!.hash).toBe(b!.hash);
  });

  it("changes the hash when the description changes", () => {
    const [a] = fingerprintTools([tool({ name: "x", description: "v1" })]);
    const [b] = fingerprintTools([tool({ name: "x", description: "v2" })]);
    expect(a!.hash).not.toBe(b!.hash);
  });

  it("changes the hash when the input schema changes", () => {
    const [a] = fingerprintTools([tool({ name: "x", inputSchema: { type: "object", properties: {} } })]);
    const [b] = fingerprintTools([tool({ name: "x", inputSchema: { type: "object", properties: { q: { type: "string" } } } })]);
    expect(a!.hash).not.toBe(b!.hash);
  });

  it("treats a missing description the same as an empty one", () => {
    const [a] = fingerprintTools([tool({ name: "x", description: undefined })]);
    const [b] = fingerprintTools([tool({ name: "x", description: "" })]);
    expect(a!.hash).toBe(b!.hash);
  });
});

describe("fingerprintSurface", () => {
  it("is the same for the same tool set regardless of order", () => {
    const a = fingerprintSurface([tool({ name: "b" }), tool({ name: "a" })]);
    const b = fingerprintSurface([tool({ name: "a" }), tool({ name: "b" })]);
    expect(a).toBe(b);
  });

  it("changes when a tool is added", () => {
    const before = fingerprintSurface([tool({ name: "a" })]);
    const after = fingerprintSurface([tool({ name: "a" }), tool({ name: "b" })]);
    expect(before).not.toBe(after);
  });

  it("changes when a tool is removed", () => {
    const before = fingerprintSurface([tool({ name: "a" }), tool({ name: "b" })]);
    const after = fingerprintSurface([tool({ name: "a" })]);
    expect(before).not.toBe(after);
  });

  it("does not change when nothing about the tools changes", () => {
    const tools = [tool({ name: "a" }), tool({ name: "b" })];
    expect(fingerprintSurface(tools)).toBe(fingerprintSurface(tools));
  });
});

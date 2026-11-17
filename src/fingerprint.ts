import { createHash } from "node:crypto";
import type { McpTool } from "./mcp.js";

export interface ToolFingerprint {
  name: string;
  /** Changes whenever this tool's name, description or input schema changes. */
  hash: string;
}

function hashOf(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

/**
 * One fingerprint per tool - name plus a hash of {name, description, inputSchema} - sorted by
 * name so the result is stable regardless of the order a server happens to list its tools in.
 * This is identity, not behaviour: two servers (or two versions of one) can fingerprint
 * identically and still behave differently at runtime, and a changed fingerprint does not by
 * itself say whether the change is good or bad - compare.ts's tool-surface diff only reports
 * what changed, leaving the verdict to the run's own pass rate and lift.
 */
export function fingerprintTools(tools: McpTool[]): ToolFingerprint[] {
  return tools.map((t) => ({ name: t.name, hash: hashOf({ name: t.name, description: t.description ?? "", inputSchema: t.inputSchema }) })).sort((a, b) => a.name.localeCompare(b.name));
}

/** A single fingerprint for the whole tool surface - changes if any tool's fingerprint does, or a tool is added or removed. */
export function fingerprintSurface(tools: McpTool[]): string {
  return hashOf(fingerprintTools(tools));
}

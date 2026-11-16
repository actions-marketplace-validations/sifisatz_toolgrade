import type { McpTool } from "./mcp.js";

export interface LintIssue {
  tool: string;
  level: "error" | "warn";
  message: string;
}

const MIN_DESCRIPTION = 30;
const LARGE_SURFACE_CHARS = 40_000;

/** Static checks on what the model actually sees: names, descriptions, parameter docs. */
export function lintTools(tools: McpTool[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const names = new Map<string, number>();

  for (const tool of tools) {
    const add = (level: LintIssue["level"], message: string) => issues.push({ tool: tool.name, level, message });
    names.set(tool.name, (names.get(tool.name) ?? 0) + 1);

    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name)) add("error", "name must match ^[a-zA-Z0-9_-]{1,64}$ or model APIs reject it");
    const desc = tool.description?.trim() ?? "";
    if (!desc) add("error", "no description: the model has only the name to go on");
    else if (desc.length < MIN_DESCRIPTION) add("warn", `description is ${desc.length} chars; say what it does, when to use it, and what it returns`);

    const props = (tool.inputSchema.properties ?? {}) as Record<string, { description?: string }>;
    const required = new Set((tool.inputSchema.required as string[] | undefined) ?? []);
    for (const [param, schema] of Object.entries(props)) {
      if (!schema?.description) add("warn", `parameter "${param}" has no description`);
    }
    for (const r of required) {
      if (!(r in props)) add("error", `required parameter "${r}" is not declared in properties`);
    }
  }

  for (const [name, count] of names) {
    if (count > 1) issues.push({ tool: name, level: "error", message: `tool name declared ${count} times` });
  }
  const size = JSON.stringify(tools).length;
  if (size > LARGE_SURFACE_CHARS) {
    issues.push({ tool: "(surface)", level: "warn", message: `tool definitions are ~${Math.round(size / 4)} tokens on every request; consider fewer, broader tools` });
  }
  return issues;
}

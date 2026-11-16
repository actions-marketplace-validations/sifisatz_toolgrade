import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { isStdio, type ServerSpec } from "./config.js";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCallOutcome {
  text: string;
  isError: boolean;
}

export interface McpSession {
  tools: McpTool[];
  callTool(name: string, args: Record<string, unknown>): Promise<ToolCallOutcome>;
  close(): Promise<void>;
}

export async function openSession(server: ServerSpec): Promise<McpSession> {
  const client = new Client({ name: "toolgrade", version: "0.1.0" });
  const transport = isStdio(server)
    ? new StdioClientTransport({
        command: server.command,
        args: server.args,
        cwd: server.cwd,
        // Minimal inherited env on purpose: the server under test must not see our model API key.
        env: { ...getDefaultEnvironment(), ...server.env },
        stderr: "ignore",
      })
    : new StreamableHTTPClientTransport(new URL(server.url), {
        requestInit: { headers: server.headers },
      });

  await client.connect(transport);
  try {
    const tools = await listAllTools(client);
    return {
      tools,
      callTool: (name, args) => callTool(client, name, args),
      close: () => client.close(),
    };
  } catch (err) {
    await client.close();
    throw err;
  }
}

async function listAllTools(client: Client): Promise<McpTool[]> {
  const tools: McpTool[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.listTools(cursor ? { cursor } : undefined);
    for (const t of page.tools) {
      tools.push({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as Record<string, unknown>,
      });
    }
    cursor = page.nextCursor;
  } while (cursor);
  return tools;
}

interface ContentPart {
  type: string;
  text?: string;
  mimeType?: string;
  uri?: string;
  resource?: { uri?: string; text?: string; mimeType?: string };
}

// Binary payloads become short placeholders: base64 inlined as text would blow up the context
// and grade nothing. Image blocks are not forwarded to the model in this version.
function describeContent(c: ContentPart): string {
  switch (c.type) {
    case "text":
      return c.text ?? "";
    case "image":
    case "audio":
      return `[${c.type} content: ${c.mimeType ?? "unknown type"}, not shown]`;
    case "resource":
      return c.resource?.text ?? `[embedded resource ${c.resource?.uri ?? ""} (${c.resource?.mimeType ?? "binary"}), not shown]`;
    case "resource_link":
      return `[resource link: ${c.uri ?? ""}]`;
    default:
      return `[${c.type} content, not shown]`;
  }
}

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolCallOutcome> {
  try {
    const result = await client.callTool({ name, arguments: args });
    const content = Array.isArray(result.content) ? result.content : [];
    const text = content.map(describeContent).join("\n");
    return { text, isError: result.isError === true };
  } catch (err) {
    return { text: `Tool call failed: ${err instanceof Error ? err.message : String(err)}`, isError: true };
  }
}


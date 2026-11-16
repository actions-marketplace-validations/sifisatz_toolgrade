// Minimal MCP server for sandbox tests: reads and writes files in its working directory.
import { readFile, writeFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "file-server", version: "0.0.0" });
const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });

server.registerTool("read", { description: "Read a file in the working directory.", inputSchema: { name: z.string() } }, async ({ name }) => {
  try {
    return text(await readFile(name, "utf8"));
  } catch {
    return { ...text(`missing: ${name}`), isError: true };
  }
});
server.registerTool("write", { description: "Write a file in the working directory.", inputSchema: { name: z.string(), body: z.string() } }, async ({ name, body }) => {
  await writeFile(name, body);
  return text(`wrote ${name}`);
});
server.registerTool("whereami", { description: "Print the working directory." }, async () => text(process.cwd()));

await server.connect(new StdioServerTransport());

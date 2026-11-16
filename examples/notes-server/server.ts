import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// NOTES_SERVER_VAGUE=1 serves the same tools with poor descriptions and an exact-title-only
// search: a realistic "worse tool surface" for demonstrating what toolgrade measures.
const VAGUE = process.env.NOTES_SERVER_VAGUE === "1";

interface Note {
  id: string;
  title: string;
  owner: string;
  body: string;
  tags: string[];
}

const notes = new Map<string, Note>();
let nextId = 1;
const add = (n: Omit<Note, "id">) => {
  const id = `n${nextId++}`;
  notes.set(id, { id, ...n });
  return id;
};

add({ title: "Q3 planning", owner: "Dana Reyes", tags: ["planning"], body: "Quarterly planning for Q3: hire two backend engineers and ship billing v2 by September." });
add({ title: "Incident 2026-10-02 postmortem", owner: "Sam Okafor", tags: ["incident"], body: "Root cause: an expired TLS certificate on the api-gateway. Fix: automated renewal plus expiry alerting." });
add({ title: "Vendor contracts", owner: "Lee Chen", tags: ["legal"], body: "Hosting contract renews 2027-01-15. Negotiate a 2-year term." });

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const fail = (s: string) => ({ content: [{ type: "text" as const, text: s }], isError: true });
const summary = (n: Note) => `${n.id} | ${n.title} | owner: ${n.owner} | tags: ${n.tags.join(", ") || "-"}`;

const server = new McpServer({ name: "notes", version: "0.1.0" });

server.registerTool(
  "search_notes",
  {
    description: VAGUE
      ? "Search."
      : "Full-text search over the team's notes (title, body, owner, tags). Case-insensitive; every word in the query must match. Returns one line per note: id | title | owner | tags. Use get_note with the id to read the full body.",
    inputSchema: {
      query: VAGUE ? z.string() : z.string().describe("Words to search for, e.g. 'q3 planning' or 'incident tls'"),
      tag: VAGUE ? z.string().optional() : z.string().optional().describe("Only return notes with this exact tag"),
    },
  },
  async ({ query, tag }) => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = [...notes.values()].filter((n) => {
      if (tag && !n.tags.includes(tag)) return false;
      if (VAGUE) return n.title === query;
      const hay = `${n.title} ${n.body} ${n.owner} ${n.tags.join(" ")}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    return text(hits.length ? hits.map(summary).join("\n") : "No notes found.");
  },
);

server.registerTool(
  "get_note",
  {
    description: VAGUE ? "Get." : "Read one note in full by its id (from search_notes). Returns title, owner, tags and body.",
    inputSchema: { id: VAGUE ? z.string() : z.string().describe("Note id, e.g. 'n1'") },
  },
  async ({ id }) => {
    const n = notes.get(id);
    return n ? text(`${summary(n)}\n\n${n.body}`) : fail(`No note with id ${id}. Use search_notes to find ids.`);
  },
);

server.registerTool(
  "create_note",
  {
    description: VAGUE ? "Make one." : "Create a new note. Returns the new note's id.",
    inputSchema: {
      title: VAGUE ? z.string() : z.string().min(1).describe("Short title"),
      body: VAGUE ? z.string() : z.string().describe("Note content"),
      owner: VAGUE ? z.string().optional() : z.string().optional().describe("Person responsible; defaults to 'unassigned'"),
      tags: VAGUE ? z.array(z.string()).optional() : z.array(z.string()).optional().describe("Lowercase tags, e.g. ['planning']"),
    },
  },
  async ({ title, body, owner, tags }) => {
    const id = add({ title, body, owner: owner ?? "unassigned", tags: tags ?? [] });
    return text(`Created note ${id}: ${title}`);
  },
);

server.registerTool(
  "delete_note",
  {
    description: VAGUE ? "Remove." : "Permanently delete a note by id. Find the id with search_notes first.",
    inputSchema: { id: VAGUE ? z.string() : z.string().describe("Note id, e.g. 'n3'") },
  },
  async ({ id }) => (notes.delete(id) ? text(`Deleted note ${id}`) : fail(`No note with id ${id}`)),
);

server.registerTool(
  "list_tags",
  { description: VAGUE ? "Tags." : "List every tag in use with its note count. Useful to discover what topics exist." },
  async () => {
    const counts = new Map<string, number>();
    for (const n of notes.values()) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return text([...counts].map(([t, c]) => `${t} (${c})`).join("\n") || "No tags.");
  },
);

await server.connect(new StdioServerTransport());

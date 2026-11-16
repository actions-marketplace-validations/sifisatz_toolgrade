import { firstUserText, type ScriptedReply } from "../src/providers/scripted.js";
import type { TurnRequest } from "../src/providers/types.js";

function toolResults(req: TurnRequest): string[] {
  const out: string[] = [];
  for (const m of req.messages) {
    if (m.role !== "user" || typeof m.content === "string") continue;
    for (const b of m.content) if (b.type === "tool_result" && typeof b.content === "string") out.push(b.content);
  }
  return out;
}

const call = (name: string, input: Record<string, unknown>): ScriptedReply => ({ toolUses: [{ name, input }] });
const idIn = (s: string | undefined) => /^(n\d+) \|/m.exec(s ?? "")?.[1];

/**
 * A competent but literal stand-in for a model, written for examples/notes-suite.yaml: it uses
 * the tools the way their descriptions suggest, and doubles as the LLM judge.
 */
export function notesAgent(req: TurnRequest): ScriptedReply {
  if (req.jsonSchema) {
    const answer = /<final_answer>\n([\s\S]*)\n<\/final_answer>/.exec(firstUserText(req))?.[1] ?? "";
    const passed = /engineers/i.test(answer) && /billing v2/i.test(answer);
    return { text: JSON.stringify({ reasoning: passed ? "both goals stated" : "goals missing", passed }) };
  }
  const prompt = firstUserText(req);
  const results = toolResults(req);
  const last = results.at(-1);
  if (prompt.includes("17 * 23")) return { text: "391" };
  if (req.tools.length === 0) return { text: "I don't have access to your notes." };

  if (prompt.includes("Who owns")) {
    if (results.length === 0) return call("search_notes", { query: "q3 planning" });
    const owner = /owner: ([^|]+)\|/.exec(last ?? "")?.[1]?.trim();
    return { text: owner ? `The owner is ${owner}.` : "I could not find that note." };
  }
  if (prompt.includes("root cause") || prompt.includes("planning for Q3")) {
    const query = prompt.includes("root cause") ? "incident" : "q3 planning";
    if (results.length === 0) return call("search_notes", { query });
    if (results.length === 1) {
      const id = idIn(last);
      return id ? call("get_note", { id }) : { text: "I could not find it." };
    }
    return { text: last?.split("\n\n")[1] ?? "" };
  }
  if (prompt.includes("Create a note")) {
    if (results.length === 0) return call("create_note", { title: "Offsite agenda", body: "Day 1: roadmap. Day 2: hackathon.", tags: ["offsite"] });
    return { text: "Created." };
  }
  if (prompt.includes("Delete")) {
    if (results.length === 0) return call("search_notes", { query: "vendor contracts" });
    if (results.length === 1) {
      const id = idIn(last);
      return id ? call("delete_note", { id }) : { text: "No such note." };
    }
    return { text: "Deleted." };
  }
  return { text: "?" };
}

// No-API-key demo: runs the real notes server through the full pipeline with a scripted model,
// once with good tool descriptions and once with the vague variant, then compares the runs.
import { join } from "node:path";
import { compareRuns } from "../src/compare.js";
import { loadSuite } from "../src/config.js";
import { ScriptedProvider } from "../src/providers/scripted.js";
import { formatComparison, formatTerminal } from "../src/report.js";
import { runSuite } from "../src/runner.js";
import { notesAgent } from "./scripted-agent.js";

const suitePath = join(import.meta.dirname, "notes-suite.yaml");

async function run(vague: boolean) {
  const suite = await loadSuite(suitePath);
  if ("command" in suite.server) suite.server.env.NOTES_SERVER_VAGUE = vague ? "1" : "0";
  suite.name = vague ? "notes-server (vague tools)" : "notes-server";
  // Scripted token counts are synthetic, so price them at zero rather than show invented dollars.
  for (const m of [suite.agent.model, suite.judge.model]) suite.pricing[m] = { input: 0, output: 0 };
  return runSuite(suite, { provider: new ScriptedProvider(notesAgent), trials: 3 });
}

const good = await run(false);
console.log(formatTerminal(good));
const vague = await run(true);
console.log(formatTerminal(vague));
console.log(`\n${formatComparison(compareRuns(good, vague))}`);

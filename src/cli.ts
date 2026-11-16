#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Command, InvalidArgumentError } from "commander";
import { compareRuns } from "./compare.js";
import { loadSuite } from "./config.js";
import { lintTools } from "./lint.js";
import { openSession } from "./mcp.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { OpenAICompatibleProvider } from "./providers/openai.js";
import type { ModelProvider } from "./providers/types.js";
import { formatComparison, formatLint, formatMarkdown, formatTerminal } from "./report.js";
import { runSuite, type RunReport } from "./runner.js";

const EXIT_GATE_FAILED = 1;
const EXIT_USAGE = 2;

const positiveInt = (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new InvalidArgumentError("must be a positive integer");
  return n;
};

const program = new Command()
  .name("toolgrade")
  .description("Eval-first quality gates for MCP servers: does your tool surface beat a no-tool baseline?")
  .version("0.1.0");

program
  .command("run")
  .description("run a suite: every task x {with tools, no tools} x N trials, then apply the gate")
  .argument("<suite>", "suite YAML file")
  .option("-t, --trials <n>", "trials per task per arm (overrides suite)", positiveInt)
  .option("-c, --concurrency <n>", "parallel trials (overrides suite)", positiveInt)
  .option("-f, --filter <idOrTag>", "only run tasks with this id or tag")
  .option("--no-baseline", "skip the no-tool baseline arm")
  .option("-o, --out-dir <dir>", "where run reports are written", ".toolgrade/runs")
  .option("--markdown <file>", "also write a Markdown summary (for PR comments)")
  .option("--compare <report>", "compare against a previous run report; regression fails the run")
  .option("--provider <name>", "anthropic, or openai for any OpenAI-compatible endpoint (Ollama, OpenAI, Gemini, Groq...)", "anthropic")
  .option("--base-url <url>", "endpoint for --provider openai", "http://localhost:11434/v1")
  .option("--api-key-env <var>", "env var holding the key for --provider openai (Ollama needs none)", "OPENAI_API_KEY")
  .option("-m, --model <id>", "agent model (overrides the suite)")
  .option("--judge-model <id>", "judge model (overrides the suite; defaults to --model when that is given)")
  .action(async (suitePath: string, o) => {
    const suite = await loadSuite(suitePath);
    if (o.model) {
      suite.agent.model = o.model;
      suite.judge.model = o.model;
    }
    if (o.judgeModel) suite.judge.model = o.judgeModel;
    // Local inference has no API bill; price it at zero unless the suite says otherwise.
    if (o.provider === "openai" && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(o.baseUrl)) {
      for (const m of [suite.agent.model, suite.judge.model]) suite.pricing[m] ??= { input: 0, output: 0 };
    }
    const previous = o.compare ? await readReport(o.compare) : undefined;
    const report = await runSuite(suite, {
      provider: makeProvider(o),
      trials: o.trials,
      concurrency: o.concurrency,
      // commander defaults a --no-* flag to true; only override the suite when the flag was given.
      baseline: o.baseline === false ? false : undefined,
      filter: o.filter,
      onTrial: (t, done, total) => {
        const mark = t.error ? "!" : t.passed ? "." : "x";
        process.stderr.write(`\r${done}/${total} trials ${mark}`);
        if (done === total) process.stderr.write("\n");
      },
    });

    await mkdir(o.outDir, { recursive: true });
    const file = join(o.outDir, `${report.startedAt.replace(/[:.]/g, "-")}.json`);
    const json = JSON.stringify(report, null, 2);
    await writeFile(file, json);
    await writeFile(join(o.outDir, "latest.json"), json);

    console.log(formatTerminal(report));
    const cmp = previous ? compareRuns(previous, report) : undefined;
    if (cmp) console.log(`\n${formatComparison(cmp)}`);
    if (o.markdown) await writeFile(o.markdown, formatMarkdown(report, cmp));
    console.log(`\nReport: ${file}`);

    if (!report.gate.passed || cmp?.verdict === "regressed") process.exitCode = EXIT_GATE_FAILED;
  });

program
  .command("inspect")
  .description("connect to the suite's server, list its tools and lint their definitions (no model calls)")
  .argument("<suite>", "suite YAML file")
  .action(async (suitePath: string) => {
    const suite = await loadSuite(suitePath);
    const session = await openSession(suite.server);
    try {
      for (const t of session.tools) console.log(`- ${t.name}: ${t.description?.split("\n")[0] ?? "(no description)"}`);
      console.log("");
      const issues = lintTools(session.tools);
      console.log(formatLint(issues, session.tools.length));
      if (issues.some((i) => i.level === "error")) process.exitCode = EXIT_GATE_FAILED;
    } finally {
      await session.close();
    }
  });

program
  .command("compare")
  .description("compare two run reports and flag statistically significant regressions")
  .argument("<before>", "earlier run report JSON")
  .argument("<after>", "later run report JSON")
  .action(async (beforePath: string, afterPath: string) => {
    const cmp = compareRuns(await readReport(beforePath), await readReport(afterPath));
    console.log(formatComparison(cmp));
    if (cmp.verdict === "regressed") process.exitCode = EXIT_GATE_FAILED;
  });

function makeProvider(o: { provider: string; baseUrl: string; apiKeyEnv: string }): ModelProvider {
  if (o.provider === "anthropic") return new AnthropicProvider();
  if (o.provider === "openai") return new OpenAICompatibleProvider({ baseUrl: o.baseUrl, apiKey: process.env[o.apiKeyEnv] });
  throw new InvalidArgumentError(`unknown provider "${o.provider}" (use anthropic or openai)`);
}

async function readReport(path: string): Promise<RunReport> {
  const report = JSON.parse(await readFile(path, "utf8")) as RunReport;
  if (report.version !== 1) throw new Error(`${path} is not a toolgrade v1 run report`);
  return report;
}

program.parseAsync().catch((err: unknown) => {
  console.error(`toolgrade: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = EXIT_USAGE;
});

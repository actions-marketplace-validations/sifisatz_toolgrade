// Builds the leaderboard from raw run reports: benchmark/results/<date>-<model>/<server>.json
// -> benchmark/results/leaderboard.json and web/src/data/benchmark.json (read by the /benchmark page).
// Every number is copied from an engine report; nothing is recomputed except per-server grouping.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RunReport } from "../src/core.ts";

const ROOT = new URL(".", import.meta.url).pathname;
const RESULTS = join(ROOT, "results");

interface Entry {
  server: string;
  package: string;
  version: string;
  model: string;
  provider: string;
  date: string;
  runDir: string;
  tools: number;
  schemaTokens: number;
  tasks: number;
  trialsPerTask: number;
  passRate: { rate: number; low: number; high: number };
  baseline: { rate: number; low: number; high: number } | null;
  lift: { delta: number; low: number; high: number } | null;
  significance: string | null;
  meanToolCalls: number;
  errors: number;
  controlPassed: number | null;
  perTask: Array<{ id: string; tags: string[]; tools: number; baseline: number | null; lift: number | null; meanToolCalls: number }>;
}

const entries: Entry[] = [];
for (const dir of (await readdir(RESULTS, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
  for (const file of (await readdir(join(RESULTS, dir))).filter((f) => f.endsWith(".json"))) {
    const r = JSON.parse(await readFile(join(RESULTS, dir, file), "utf8")) as RunReport;
    const server = file.replace(/\.json$/, "");
    // Suites are named "<package>@<version>"; scoped packages contain "@" too, so split at the last one.
    const at = r.suite.lastIndexOf("@");
    const pkgName = at > 0 ? r.suite.slice(0, at) : r.suite;
    const pkgVersion = at > 0 ? r.suite.slice(at + 1) : "unknown";
    const o = r.overall;
    const tasks = r.tasks;
    const graded = tasks.filter((t) => t.tools.rate.n > 0);
    const control = tasks.find((t) => t.taskId === "no-tool-needed");
    entries.push({
      server,
      package: pkgName,
      version: pkgVersion,
      model: r.agentModel,
      provider: r.provider,
      date: r.startedAt.slice(0, 10),
      runDir: dir,
      tools: r.toolSurface.count,
      schemaTokens: r.toolSurface.approxTokens,
      tasks: tasks.length,
      trialsPerTask: r.trialsPerTask,
      passRate: { rate: o.tools.rate.rate, low: o.tools.rate.low, high: o.tools.rate.high },
      baseline: o.baseline ? { rate: o.baseline.rate.rate, low: o.baseline.rate.low, high: o.baseline.rate.high } : null,
      lift: o.lift ? { delta: o.lift.delta, low: o.lift.low, high: o.lift.high } : null,
      significance: o.liftSignificance ?? null,
      meanToolCalls: graded.length ? graded.reduce((s, t) => s + t.tools.meanToolCalls, 0) / graded.length : 0,
      errors: o.tools.trials.errors + (o.baseline?.trials.errors ?? 0),
      controlPassed: control ? control.tools.rate.rate : null,
      perTask: tasks.map((t) => ({
        id: t.taskId,
        tags: t.tags,
        tools: t.tools.rate.rate,
        baseline: t.baseline ? t.baseline.rate.rate : null,
        lift: t.lift ? t.lift.delta : null,
        meanToolCalls: t.tools.meanToolCalls,
      })),
    });
  }
}

entries.sort((a, b) => (b.lift?.delta ?? -2) - (a.lift?.delta ?? -2) || b.passRate.rate - a.passRate.rate);
const leaderboard = { generatedAt: new Date().toISOString(), entries };
const json = `${JSON.stringify(leaderboard, null, 2)}\n`;
await writeFile(join(RESULTS, "leaderboard.json"), json);
await writeFile(join(ROOT, "..", "web", "src", "data", "benchmark.json"), json);
console.log(`leaderboard: ${entries.length} entries`);
for (const e of entries) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  console.log(`  ${e.server.padEnd(22)} ${e.model.padEnd(12)} pass ${pct(e.passRate.rate).padStart(4)}  baseline ${e.baseline ? pct(e.baseline.rate) : "-"}  lift ${e.lift ? `${e.lift.delta >= 0 ? "+" : ""}${Math.round(e.lift.delta * 100)}pp` : "-"} (${e.significance ?? "-"})`);
}

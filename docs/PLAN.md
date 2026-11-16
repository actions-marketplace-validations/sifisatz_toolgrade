# ToolGrade - research notes, product plan, PoC scope

## 1. The problem

Every developer platform now ships an MCP server, agent skills, or an in-product assistant.
Almost none of them can answer the only question that matters:

> Do my tools make an agent *better* at real tasks than the same agent with no tools?

Today teams answer it by vibes: try a few prompts in a chat client, ship, hope. When the
underlying model changes, or someone rewrites a tool description, nobody knows whether quality
moved. Companies that take it seriously are hiring dedicated engineers to build an internal
"eval-first" harness by hand. That repeated, bespoke build is the market.

## 2. What exists and why it is not enough

| Category | Examples | Gap for MCP-tool authors |
|---|---|---|
| General LLM eval / tracing platforms | Braintrust, LangSmith, Langfuse, promptfoo | Prompt-and-output centric. You can wire an MCP server in, but there is no first-class notion of a *tool surface under test*, a no-tool baseline arm, or end-state verification against the server. |
| MCP inspectors / debuggers | MCP Inspector | Manual, single-call, no task success, no statistics. |
| Public agent benchmarks | tool-use leaderboards | Measure models, not *your* tools. |

The durable gap: **tool authors need a CI gate for their tool surface**, the way they have unit
tests for their code.

## 3. Principles (what separates a durable pattern from hype)

1. **Baseline or it did not happen.** Every task runs in two arms - with tools, and with no
   tools. The product headline is the *lift*, not the raw pass rate. A tool that does not beat
   the baseline is a cost (tokens, latency, confusion), not a feature.
2. **Grade outcomes, not claims.** Agents say "done" when they are not. Assertions can query
   the server's real state after the run (`state` assertion), not just read the transcript.
3. **Variance is a first-class output.** Agents are stochastic. Every task runs N trials;
   pass rates come with 95% Wilson intervals, lift with a Newcombe interval, and the
   regression gate distinguishes "significantly worse" from "inconclusive - run more trials".
4. **Deterministic checks first, LLM judge last.** Cheap, exact assertions (tool called,
   arguments, output contains, end state) carry the weight; the LLM judge is reserved for
   open-ended quality and is itself tracked for cost.
5. **Cost is a metric, not an afterthought.** Tokens and dollars per trial, per arm, plus the
   tool-schema size the tools add to every request.
6. **Isolation.** Each stdio trial gets a fresh server process, so state from one trial can
   never leak into the next.

## 4. Product shape (SaaS)

- **Open-source CLI + GitHub Action (the wedge).** `npx toolgrade run suite.yaml` in CI, a
  Markdown report as a PR comment, non-zero exit on gate failure. Free, local, BYO API key.
- **Hosted tier (the business).** Run history and trend lines per tool, model-drift alerts
  ("your pass rate on the new model dropped 12 points"), a shared task library per product
  surface, managed parallel runners, team review of judge disagreements, and production
  telemetry ingestion so real agent sessions turn into new eval tasks.
- **Pricing.** Free CLI. Team plan per seat + metered trial-minutes. Enterprise: SSO, VPC
  runners, audit.

## 5. PoC scope (this repository)

In:
- Suite file (YAML, zod-validated): server, agent, judge, run, gate, tasks with assertions.
- MCP connection over stdio (fresh process per trial) and Streamable HTTP.
- Agent loop with full trajectory capture (tool calls, args, results, errors, tokens, latency).
- Two arms (tools / baseline) x N trials, bounded concurrency.
- Assertions: `output_contains`, `output_regex`, `tool_called` (count + argument match),
  `tool_not_called`, `max_tool_calls`, `state` (post-run tool query), `llm` (rubric judge).
- Statistics: Wilson CI, Newcombe CI for lift, two-run regression comparison.
- Cost accounting with an overridable price table.
- `inspect` command: lists tools and lints their descriptions/schemas without any API key.
- Reports: terminal, JSON run file, Markdown for PR comments; gate exit codes.
- Provider abstraction: Anthropic for real runs, a scripted provider for deterministic tests.
- Example MCP server (notes) with a deliberately degraded "vague" variant to demo the lift.

Out (v2): hosted dashboard, auth, billing, OpenAI/other providers, trace ingestion,
multi-turn simulated users.

## 6. Stack decisions

| Decision | Choice | Why |
|---|---|---|
| Language | TypeScript on Node 20+ | The MCP SDK and most MCP servers are TS; the audience lives in npm. |
| Packaging | ESM, plain `tsc` build, `bin` entry | Fewest moving parts; `npx toolgrade` works. |
| Validation | zod | Readable errors on bad suite files; already an MCP SDK peer. |
| CLI | commander | Small, typed, standard. |
| Tests | vitest | Fast; the end-to-end test drives a real MCP server over stdio. |
| Model client | `@anthropic-ai/sdk`, manual loop | We need the transport-agnostic loop and full trajectory capture. |
| Storage | JSON files in `.toolgrade/runs/` | Diffable, CI-artifact friendly; hosted tier replaces this. |

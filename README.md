# ToolGrade

**Eval-first quality gates for MCP servers.** ToolGrade answers one question with evidence:
*does your tool surface make an agent better at real tasks than the same agent with no tools?*

Every task runs in two arms - **with your tools** and **with no tools** - over several trials.
You get pass rates with confidence intervals, the **lift** over the baseline, cost per trial,
and a CI gate that fails when quality drops.

Output of `pnpm demo` (real pipeline and real example server; a scripted stand-in replaces the
model, so it runs with no API key):

```
ToolGrade - notes-server
task                 with tools  baseline    lift    calls
find-owner           100% (3/3)  0% (0/3)    +100pp  1.0
incident-root-cause  100% (3/3)  0% (0/3)    +100pp  2.0
create-note          100% (3/3)  0% (0/3)    +100pp  1.0
delete-note          100% (3/3)  0% (0/3)    +100pp  2.0
no-tool-needed       100% (3/3)  100% (3/3)  +0pp    0.0
summarize-plan       100% (3/3)  0% (0/3)    +100pp  2.0

Pass rate (tools)  100%  95% CI 82%-100%
Pass rate (none)   17%  95% CI 6%-39%
Lift               +83pp  95% CI +55pp..+94pp  significant
Gate passed

ToolGrade - notes-server (vague tools)      <- same agent, vague descriptions, worse search
Pass rate (tools)  33%  95% CI 16%-56%
Lift               +17pp  95% CI -12pp..+42pp  not significant - add trials
FAIL min_pass_rate: pass rate 33% vs required 80%
Gate failed

Comparison: regressed
overall 100% -> 33%  -67pp  95% CI -84pp..-38pp
  find-owner                   100% ->   0%  worse
  create-note                  100% -> 100%  ~
  delete-note                  100% ->   0%  worse
```

## Why

- **Baseline or it did not happen.** A tool that does not beat "no tools" is a cost (schema
  tokens, latency, distraction), not a feature. The headline metric is the lift.
- **Grade outcomes, not claims.** `state` assertions query your server after the run, so an
  agent that *says* it deleted the note but did not, fails.
- **Variance is reported, not hidden.** Wilson intervals on pass rates, a Newcombe interval on
  lift, and run-to-run comparison that says "inconclusive - add trials" instead of guessing.
- **Fresh server per trial.** stdio servers are re-spawned for every trial, so state never
  leaks between trials or arms. HTTP servers get a fresh connection but ToolGrade cannot reset
  their data - point them at a disposable test environment.
- **Your API key stays yours.** The server under test gets a minimal environment plus what the
  suite declares - never the model credentials.

## Quick start

```bash
pnpm install && pnpm build
pnpm demo                                             # full pipeline offline, no API key
node dist/cli.js inspect examples/notes-suite.yaml   # list + lint tools, no API key needed
export ANTHROPIC_API_KEY=...                          # or `ant auth login`
node dist/cli.js run examples/notes-suite.yaml --trials 3 --markdown summary.md
```

Demonstrate a regression: set `NOTES_SERVER_VAGUE: "1"` in the suite (same tools, vague
descriptions and an exact-title-only search), run again, then:

```bash
node dist/cli.js compare .toolgrade/runs/<good>.json .toolgrade/runs/latest.json
```

## Commands

| Command | What it does | Exit code |
|---|---|---|
| `run <suite>` | tasks x {tools, baseline} x trials, then the gate. Writes `.toolgrade/runs/<ts>.json` and `latest.json`. `--compare <report>` fails on a significant regression. `--markdown <file>` for PR comments. | 0 pass, 1 gate failed / regressed, 2 error |
| `inspect <suite>` | Connects, lists tools, lints names/descriptions/parameter docs. | 1 on lint errors |
| `compare <before> <after>` | Statistical comparison of two run reports. | 1 if regressed |

## Suite file

```yaml
name: my-server
server:                      # stdio (fresh process per trial) ...
  command: node
  args: [dist/server.js]
  cwd: ..                    # relative to this file
  env: { DATABASE_URL: "postgres://localhost/test" }
# server: { url: https://localhost:3000/mcp, headers: { Authorization: "Bearer test" } }

agent:  { model: claude-opus-5, max_turns: 10, effort: medium, system: "optional" }
judge:  { model: claude-sonnet-5 }
run:    { trials: 3, baseline: true, concurrency: 4 }
gate:   { min_pass_rate: 0.8, min_lift: 0.3 }
pricing: { my-custom-model: { input: 2, output: 10 } }   # USD per MTok, overrides defaults

tasks:
  - id: create-note
    tags: [write]
    prompt: Create a note titled 'Offsite agenda' ...
    assert:                                   # a trial passes when every assertion passes
      - { type: tool_called, name: create_note, max_times: 1, args_contains: { title: Offsite } }
      - { type: state, tool: search_notes, args: { query: Offsite agenda }, contains: Offsite agenda }
```

| Assertion | Passes when |
|---|---|
| `output_contains` | final answer contains `value` (string or list; `mode: all\|any`, `case_sensitive`) |
| `output_regex` | final answer matches `pattern` (`flags`, default `i`) |
| `tool_called` | tool called `min_times..max_times`, optionally with `args_contains` (substring for strings, deep-equal otherwise) |
| `tool_not_called` | tool never called |
| `max_tool_calls` | total tool calls <= `value` (use `0` for "tools must not distract") |
| `state` | after the run, calling `tool` with `args` returns text containing `contains` and none of `not_contains` |
| `llm` | the judge model, given task, tool trace and answer, says the `rubric` is met (structured JSON verdict; unparseable = fail) |

A trial that hits `max_turns` fails regardless of assertions. Trials that error count as
failures and fail the `no_errors` gate check. Configuration-level API errors (bad key, unknown
model, malformed request) abort the run instead of producing a meaningless score.

Write `state` probes that work across every server variant you compare - a probe that depends on
the behaviour under test can pass for the wrong reason.

## Library use

```ts
import { loadSuite, runSuite, AnthropicProvider, ScriptedProvider } from "toolgrade";
const report = await runSuite(await loadSuite("suite.yaml"), { provider: new AnthropicProvider() });
```

`ScriptedProvider` drives the whole pipeline deterministically - that is how this repo's
end-to-end tests run against the real example server with no API key.

## CI

See [examples/github-workflow.yml](examples/github-workflow.yml) and [action.yml](action.yml)
(the `toolgrade/toolgrade` action reference is a placeholder until the package is published).

## Statistics notes

Pass rates pool all trials of an arm and use a 95% Wilson interval; lift uses Newcombe's hybrid
score interval. Trials of the same task are correlated, so with few tasks the intervals are
optimistic - prefer more tasks over more trials when you can. Cost uses list prices from
[src/pricing.ts](src/pricing.ts); unknown models are reported as `n/a` rather than guessed.

## Roadmap

See [docs/PLAN.md](docs/PLAN.md): hosted run history and model-drift alerts, shared task
libraries, trace ingestion that turns real agent sessions into tasks, more providers.

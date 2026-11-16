# ToolGrade MCP Server Benchmark (v0)

Does a given MCP server make an agent better at real tasks than the same agent with no tools?
This benchmark answers that for widely used, credential-free reference servers, with the same
engine and statistics ToolGrade uses in CI.

Results: [results/leaderboard.json](results/leaderboard.json) and https://sifisatz.github.io/toolgrade/benchmark/

## What is graded

| Server | Version (pinned) | Tasks | What the checks look at |
|---|---|---|---|
| `@modelcontextprotocol/server-filesystem` | 2.3.0 | 6 + control | the answer, or files on disk after the run |
| `@modelcontextprotocol/server-memory` | 2.1.1 | 5 + control | the answer, or the knowledge graph after the run |
| `@modelcontextprotocol/server-sequential-thinking` | 2.1.1 | 5 + control | the answer to a multi-step problem |

Versions are pinned in [package.json](package.json); suites are in [suites/](suites/).

## Method

- **Two arms.** Every task runs with the server's tools and with no tools, 3 trials each.
- **Outcome checks only.** A trial passes when the answer is right or the server's state is right
  afterwards (a file's contents, an entity in the graph) - never because a particular tool was
  called. The no-tool baseline is graded on the same outcomes.
- **Fresh sandbox per trial.** Each trial gets a private copy of the suite's fixture
  (`fixtures/`) as the server's working data, so no trial sees another's changes.
- **A control task** ("What is 17 * 23?", no tool calls allowed) checks that the tools do not
  distract the agent on something it can do alone.
- **Statistics.** Tasks, not trials, are the sample: suite pass rates use a 95% Wilson interval
  at n = tasks and lift uses Newcombe's hybrid score interval. With 6-7 tasks per server the
  intervals are wide on purpose - a "significant" lift here is a strong result.
- **Checks are tested.** [test/benchmark-suites.test.ts](../test/benchmark-suites.test.ts) runs a
  reference solution for every task against the real pinned server (it must pass) and the
  untouched starting state (it must fail), so no check can pass vacuously.

## Limitations - read before quoting a number

- A score belongs to **server + model + task set**, never to the server alone. v0 uses one
  open-weights model (`qwen3:8b`, run locally via Ollama); a stronger model would score higher,
  and tool descriptions matter more for small models.
- Tasks are written by the ToolGrade authors; 5-6 tasks per server cannot cover a server's
  whole surface. Suggestions and new tasks are welcome as pull requests.
- `sequential-thinking` has no state to check, so its tasks are reasoning problems; a lift near
  zero means the scaffold did not help on these problems with this model, not that it never helps.
- Servers that need accounts or API keys (GitHub, Slack, ...) are not in v0.

## Reproduce

```bash
pnpm install && pnpm build
ollama pull qwen3:8b && ollama serve          # or any OpenAI-compatible endpoint
benchmark/run.sh openai qwen3:8b               # ~40 minutes on a laptop
npx tsx benchmark/summarize.mts                 # rebuilds the leaderboard
```

With a hosted model: `benchmark/run.sh anthropic claude-sonnet-5` (needs `ANTHROPIC_API_KEY`).

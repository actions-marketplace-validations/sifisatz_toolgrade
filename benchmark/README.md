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

## What failed, and why (v0, qwen3:8b)

Read from the trial trajectories in `results/2026-11-16-qwen3-8b/`:

- **memory / recall-lead - 0/3.** Every trial called `search_nodes` with `observationLimit: 0`,
  which omits each entity's observations. The model found the project lead but never saw
  "Ships in December" and reported that no ship date exists. Optional parameters that silently
  drop data invite small models to suppress exactly what they need.
- **filesystem / top-region - 0/3.** The model invented a filename (`Q3_revenue_report.txt`),
  searched for its own guess and gave up, never listing the directory where `reports/q3.csv` sat.
- **filesystem / append-todo - 1/3.** One trial appended to an invented `notes/todo.md` and
  reported success; another used a made-up `/project/...` path the server refused. The passing
  trial overwrote the whole file before rebuilding it.

- **sequential-thinking - no lift.** All five reasoning problems passed 3/3 with and without the
  tool. The model still called it ~0.7 times per task, and once used it for 17 * 23 (right answer,
  but the control task allows no tool calls). On these problems it added cost, not accuracy.

## Limitations - read before quoting a number

- A score belongs to **server + model + task set**, never to the server alone. v0 uses one
  open-weights model (`qwen3:8b`, run locally via Ollama); a stronger model would score higher,
  and tool descriptions matter more for small models.
- Tasks are written by the ToolGrade authors; 5-6 tasks per server cannot cover a server's
  whole surface. Suggestions and new tasks are welcome as pull requests.
- `sequential-thinking` has no state to check, so its tasks are reasoning problems; a lift near
  zero means the scaffold did not help on these problems with this model, not that it never helps.
- Servers that need accounts or API keys (GitHub, Slack, ...) are not in v0.

## Reproduce (containerised - recommended)

Nothing is installed on the host except Podman. The model and every MCP server under test run in
containers on a dedicated Podman machine:

| Container | What | Isolation |
|---|---|---|
| `tg-ollama` | Ollama 0.40.16 serving the model from the `tg-ollama` volume | internal network only |
| `toolgrade-runner` | the CLI and the pinned MCP servers; servers are spawned inside it | internal network (reaches only `tg-ollama`, no internet), non-root, read-only root filesystem, all capabilities dropped; writes only `benchmark/results` and a `/tmp` tmpfs for trial sandboxes |

```bash
benchmark/container/tg.sh up                     # dedicated 'toolgrade' Podman machine + Ollama
benchmark/container/tg.sh pull qwen3:8b          # once: downloads the model into the volume
benchmark/container/tg.sh build                  # runner image
benchmark/container/tg.sh run qwen3:8b           # all suites, or name suites after the model
npx tsx benchmark/summarize.mts                  # rebuilds the leaderboard
benchmark/container/tg.sh down                   # stop the containers and the machine
```

Podman on macOS runs one machine at a time, so `up` refuses to start while another machine is
running. If a machine then fails to start again with a `gvproxy` socket error, or its published
ports report "address already in use", a `gvproxy` from its previous session is still alive
(`ps -axo pid,etime,command | grep gvproxy`); stop that exact PID and start the machine again. On a Mac the model runs on CPU inside the VM (the official arm64 Ollama image has no
Vulkan backend); `qwen3:8b` generates ~28 tokens/s on 8 cores.

Without containers: `ollama serve`, then `benchmark/run.sh openai qwen3:8b` on the host. With a
hosted model: `benchmark/run.sh anthropic claude-sonnet-5` (needs `ANTHROPIC_API_KEY`).

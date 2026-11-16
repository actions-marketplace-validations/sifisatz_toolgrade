## ToolGrade: server-filesystem@2.3.0 - passed

Provider `openai-compatible`, agent `qwen3:8b`, judge `qwen3:8b`, 3 trial(s) per task, 16 tools (~3224 schema tokens).

| | Pass rate | 95% CI |
|---|---|---|
| With tools | 67% over 7 tasks (14/21 trials) | 32%-89% |
| No tools (baseline, outcomes only) | 14% over 7 tasks (3/21 trials) | 3%-51% |
| **Lift** | **+52pp** | +2pp..+78pp (better) |

| Task | With tools | Baseline | Lift | Mean tool calls |
|---|---|---|---|---|
| `find-decision` | 67% (2/3) | 0% (0/3) | +67pp | 3.7 |
| `top-region` | 0% (0/3) | 0% (0/3) | +0pp | 3.3 |
| `edit-config` | 100% (3/3) | 0% (0/3) | +100pp | 1.0 |
| `append-todo` | 33% (1/3) | 0% (0/3) | +33pp | 2.3 |
| `create-changelog` | 100% (3/3) | 0% (0/3) | +100pp | 3.0 |
| `rename-report` | 67% (2/3) | 0% (0/3) | +67pp | 1.7 |
| `no-tool-needed` | 100% (3/3) | 100% (3/3) | +0pp | 0.0 |

Cost: $0.0000. Gate: no_errors ok.
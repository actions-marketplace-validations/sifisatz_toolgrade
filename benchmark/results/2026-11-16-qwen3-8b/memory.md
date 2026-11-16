## ToolGrade: server-memory@2.1.1 - passed

Provider `openai-compatible`, agent `qwen3:8b`, judge `qwen3:8b`, 3 trial(s) per task, 9 tools (~1886 schema tokens).

| | Pass rate | 95% CI |
|---|---|---|
| With tools | 83% over 6 tasks (15/18 trials) | 44%-97% |
| No tools (baseline, outcomes only) | 17% over 6 tasks (3/18 trials) | 3%-56% |
| **Lift** | **+67pp** | +11pp..+86pp (better) |

| Task | With tools | Baseline | Lift | Mean tool calls |
|---|---|---|---|---|
| `recall-lead` | 0% (0/3) | 0% (0/3) | +0pp | 1.0 |
| `remember-person` | 100% (3/3) | 0% (0/3) | +100pp | 1.0 |
| `relate-people` | 100% (3/3) | 0% (0/3) | +100pp | 2.0 |
| `update-fact` | 100% (3/3) | 0% (0/3) | +100pp | 1.0 |
| `forget-person` | 100% (3/3) | 0% (0/3) | +100pp | 1.0 |
| `no-tool-needed` | 100% (3/3) | 100% (3/3) | +0pp | 0.0 |

Cost: $0.0000. Gate: no_errors ok.
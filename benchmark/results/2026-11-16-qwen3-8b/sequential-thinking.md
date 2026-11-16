## ToolGrade: server-sequential-thinking@2.1.1 - passed

Provider `openai-compatible`, agent `qwen3:8b`, judge `qwen3:8b`, 3 trial(s) per task, 1 tools (~544 schema tokens).

| | Pass rate | 95% CI |
|---|---|---|
| With tools | 94% over 6 tasks (17/18 trials) | 55%-100% |
| No tools (baseline, outcomes only) | 100% over 6 tasks (18/18 trials) | 61%-100% |
| **Lift** | **-6pp** | -45pp..+34pp (not significant) |

| Task | With tools | Baseline | Lift | Mean tool calls |
|---|---|---|---|---|
| `bat-and-ball` | 100% (3/3) | 100% (3/3) | +0pp | 0.0 |
| `weekday-offset` | 100% (3/3) | 100% (3/3) | +0pp | 0.7 |
| `meeting-rooms` | 100% (3/3) | 100% (3/3) | +0pp | 1.0 |
| `ordering` | 100% (3/3) | 100% (3/3) | +0pp | 0.7 |
| `discount-chain` | 100% (3/3) | 100% (3/3) | +0pp | 1.3 |
| `no-tool-needed` | 67% (2/3) | 100% (3/3) | -33pp | 0.3 |

Cost: $0.0000. Gate: no_errors ok.
#!/usr/bin/env bash
# Runs the public benchmark. Usage: benchmark/run.sh <provider> <model> [base-url] [suite...]
#   benchmark/run.sh openai qwen3:8b http://localhost:11434/v1     # local, free, all suites
#   benchmark/run.sh openai qwen3:8b http://localhost:11434/v1 sequential-thinking   # one suite
#   benchmark/run.sh anthropic claude-sonnet-5                     # needs ANTHROPIC_API_KEY
# Writes one report per server to benchmark/results/<date>-<model>/<server>.json
# OUT_DIR overrides the results folder (e.g. to finish a run started on an earlier day).
set -uo pipefail
cd "$(dirname "$0")/.."
PROVIDER=${1:?provider}; MODEL=${2:?model}; BASE_URL=${3:-http://localhost:11434/v1}
shift $(( $# < 3 ? $# : 3 ))
SLUG=$(printf '%s' "$MODEL" | tr -c 'A-Za-z0-9.-' '-' | sed 's/-*$//')
OUT=${OUT_DIR:-"benchmark/results/$(date +%Y-%m-%d)-$SLUG"}
mkdir -p "$OUT"
if [ $# -gt 0 ]; then SUITES=(); for s in "$@"; do SUITES+=("benchmark/suites/$s.yaml"); done; else SUITES=(benchmark/suites/*.yaml); fi
for suite in "${SUITES[@]}"; do
  name=$(basename "$suite" .yaml)
  echo "=== $name ($MODEL)"
  node dist/cli.js run "$suite" --provider "$PROVIDER" --base-url "$BASE_URL" --model "$MODEL" \
    --out-dir "$OUT/.runs/$name" --markdown "$OUT/$name.md" > "$OUT/$name.log" 2>&1
  echo "exit=$?"
  cp "$OUT/.runs/$name/latest.json" "$OUT/$name.json" 2>/dev/null || echo "no report for $name"
done
rm -rf "$OUT/.runs"
echo "results in $OUT"

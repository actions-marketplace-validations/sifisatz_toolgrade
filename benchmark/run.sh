#!/usr/bin/env bash
# Runs the public benchmark. Usage: benchmark/run.sh <provider> <model> [base-url]
#   benchmark/run.sh openai qwen3:8b http://localhost:11434/v1     # local, free
#   benchmark/run.sh anthropic claude-sonnet-5                     # needs ANTHROPIC_API_KEY
# Writes one report per server to benchmark/results/<date>-<model>/<server>.json
set -uo pipefail
cd "$(dirname "$0")/.."
PROVIDER=${1:?provider}; MODEL=${2:?model}; BASE_URL=${3:-http://localhost:11434/v1}
SLUG=$(printf '%s' "$MODEL" | tr -c 'A-Za-z0-9.-' '-' | sed 's/-*$//')
OUT="benchmark/results/$(date +%Y-%m-%d)-$SLUG"
mkdir -p "$OUT"
for suite in benchmark/suites/*.yaml; do
  name=$(basename "$suite" .yaml)
  echo "=== $name ($MODEL)"
  node dist/cli.js run "$suite" --provider "$PROVIDER" --base-url "$BASE_URL" --model "$MODEL" \
    --out-dir "$OUT/.runs/$name" --markdown "$OUT/$name.md" > "$OUT/$name.log" 2>&1
  echo "exit=$?"
  cp "$OUT/.runs/$name/latest.json" "$OUT/$name.json" 2>/dev/null || echo "no report for $name"
done
rm -rf "$OUT/.runs"
echo "results in $OUT"

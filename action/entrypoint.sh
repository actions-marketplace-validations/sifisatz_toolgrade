#!/usr/bin/env bash
# The composite action's actual logic, pulled out of action.yml so it can be covered by an
# integration test (test/action-entrypoint.test.ts) without going through the real npm registry
# or a GitHub Actions runner. Reads TG_* env vars set by action.yml from its inputs.
set -euo pipefail

# TOOLGRADE_ACTION_BIN overrides how the CLI is invoked - unset/empty in normal use (npx against
# the published package), set by the integration test to run a local build or fake CLI instead.
if [ -n "${TOOLGRADE_ACTION_BIN:-}" ]; then
  # Intentionally unquoted: the override is a shell command line (e.g. "node dist/cli.js"), not a
  # single path, and only ever set by our own test/CI code, never by action.yml's public inputs.
  # shellcheck disable=SC2206
  bin=($TOOLGRADE_ACTION_BIN)
else
  bin=(npx --yes "toolgrade@$TG_VERSION")
fi

# The caller's own TOOLGRADE_API_KEY (set as `env:` on the step that calls this action) is already
# inherited here; the input is just a more discoverable way to pass the same thing.
[ -n "${TG_API_KEY_INPUT:-}" ] && export TOOLGRADE_API_KEY="$TG_API_KEY_INPUT"

args=(run "$TG_SUITE" --markdown .toolgrade/summary.md)
[ -n "${TG_TRIALS:-}" ] && args+=(--trials "$TG_TRIALS")
[ -n "${TG_CONCURRENCY:-}" ] && args+=(--concurrency "$TG_CONCURRENCY")
[ -n "${TG_FILTER:-}" ] && args+=(--filter "$TG_FILTER")
[ "${TG_NO_BASELINE:-}" = "true" ] && args+=(--no-baseline)
[ -n "${TG_COMPARE:-}" ] && args+=(--compare "$TG_COMPARE")
[ -n "${TG_BASELINE:-}" ] && args+=(--baseline "$TG_BASELINE")
[ -n "${TG_BASELINE_BRANCH:-}" ] && args+=(--baseline-branch "$TG_BASELINE_BRANCH")
[ -n "${TG_MODEL:-}" ] && args+=(--model "$TG_MODEL")
[ -n "${TG_JUDGE_MODEL:-}" ] && args+=(--judge-model "$TG_JUDGE_MODEL")
[ -n "${TG_PROVIDER:-}" ] && args+=(--provider "$TG_PROVIDER")
[ -n "${TG_BASE_URL:-}" ] && args+=(--base-url "$TG_BASE_URL")
[ -n "${TG_API_KEY_ENV:-}" ] && args+=(--api-key-env "$TG_API_KEY_ENV")
[ "${TG_LOCAL_MODEL:-}" = "true" ] && args+=(--local-model)
[ -n "${TG_UPLOAD_URL:-}" ] && args+=(--upload "$TG_UPLOAD_URL")

mkdir -p .toolgrade
set +e
"${bin[@]}" "${args[@]}"
code=$?
set -e
[ -f .toolgrade/summary.md ] && cat .toolgrade/summary.md >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
exit $code

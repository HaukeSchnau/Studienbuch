#!/usr/bin/env sh
set -euo pipefail

# shellcheck disable=SC1091
. "$(dirname "$0")/common.sh"

root_dir="$(qa_repo_root)"
cd "$root_dir"

run_dir="$(qa_ensure_run_dir)"
failures=0

printf "QA run dir: %s\n" "$run_dir"

if QA_RUN_DIR="$run_dir" "$root_dir/tooling/qa/capture-run-metadata.sh"; then
  :
else
  failures=$((failures + 1))
fi

if QA_RUN_DIR="$run_dir" "$root_dir/tooling/qa/service-smoke.sh"; then
  :
else
  failures=$((failures + 1))
fi

if QA_RUN_DIR="$run_dir" "$root_dir/tooling/qa/console-smoke.sh"; then
  :
else
  failures=$((failures + 1))
fi

if [ "$failures" -gt 0 ]; then
  printf "QA smoke run completed with %s failing step(s). Artifacts: %s\n" "$failures" "$run_dir" >&2
  exit 1
fi

printf "QA smoke run passed. Artifacts: %s\n" "$run_dir"

#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1091
. "$(dirname "$0")/common.sh"

root_dir="$(qa_repo_root)"
cd "$root_dir"
qa_load_env_files

run_dir="$(qa_ensure_run_dir)"
report_file="$run_dir/console-smoke.tsv"
printf "check\tresult\tdetails\n" >"$report_file"
failures=0

record_result() {
  check_name="$1"
  result="$2"
  details="$3"
  printf "%s\t%s\t%s\n" "$check_name" "$result" "$details" >>"$report_file"
  printf "%s: %s (%s)\n" "$check_name" "$result" "$details"
}

help_log="$run_dir/console-help.log"
if just console -- --help >"$help_log" 2>&1; then
  record_result "console_help" "PASS" "just console -- --help"
else
  record_result "console_help" "FAIL" "just console -- --help"
  failures=$((failures + 1))
fi

if grep -q "bootstrap-broadcast" "$help_log"; then
  record_result "bootstrap_broadcast_listed" "PASS" "command listed in help output"
else
  record_result "bootstrap_broadcast_listed" "FAIL" "command missing from help output"
  failures=$((failures + 1))
fi

safe_help_log="$run_dir/bootstrap-broadcast-safe-help.log"
if just console -- bootstrap-broadcast --help >"$safe_help_log" 2>&1; then
  record_result "bootstrap_broadcast_safe_check" "PASS" "subcommand help invocation succeeded"
else
  if [ "${QA_ALLOW_BOOTSTRAP_BROADCAST:-0}" = "1" ]; then
    bootstrap_log="$run_dir/bootstrap-broadcast.log"
    if just console -- bootstrap-broadcast >"$bootstrap_log" 2>&1; then
      record_result "bootstrap_broadcast_safe_check" "PASS" "executed bootstrap-broadcast with QA_ALLOW_BOOTSTRAP_BROADCAST=1"
    else
      record_result "bootstrap_broadcast_safe_check" "FAIL" "bootstrap-broadcast execution failed"
      failures=$((failures + 1))
    fi
  else
    record_result "bootstrap_broadcast_safe_check" "SKIP" "safe execution unavailable; set QA_ALLOW_BOOTSTRAP_BROADCAST=1 to run"
  fi
fi

if [ "$failures" -gt 0 ]; then
  printf "Console smoke checks failed (%s). Report: %s\n" "$failures" "$report_file" >&2
  exit 1
fi

printf "Console smoke checks passed. Report: %s\n" "$report_file"

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

WEB_BASE_URL="${WEB_BASE_URL:-${QA_WEB_ENDPOINT:-http://localhost:${STU_NEXTJS_PORT:-3000}}}"
RUN_ID="${RUN_ID:-$(date -u +"%Y%m%dT%H%M%SZ")}"
ARTIFACT_ROOT="${ARTIFACT_ROOT:-$REPO_ROOT/.artifacts/qa/web-admin-smoke}"
ARTIFACT_DIR="${ARTIFACT_DIR:-$ARTIFACT_ROOT/$RUN_ID}"
SESSION_NAME="${AGENT_BROWSER_SESSION:-web-admin-smoke-${RUN_ID}-$$}"
WAIT_FOR_LOAD="${AGENT_BROWSER_WAIT_FOR_LOAD:-domcontentloaded}"

LOG_FILE="$ARTIFACT_DIR/run.log"
SUMMARY_FILE="$ARTIFACT_DIR/summary.tsv"
PRECONDITIONS_FILE="$ARTIFACT_DIR/preconditions.txt"

AGENT_BROWSER_CMD=()
CHECK_FAILURE_REASON=""
HAS_FAILURES=0

mkdir -p "$ARTIFACT_DIR"
: >"$LOG_FILE"
printf "check\tstatus\tdetail\n" >"$SUMMARY_FILE"

log() {
  printf '[%s] %s\n' "$(date +"%Y-%m-%d %H:%M:%S")" "$*" | tee -a "$LOG_FILE"
}

append_summary() {
  local check="$1"
  local status="$2"
  local detail="$3"
  printf '%s\t%s\t%s\n' "$check" "$status" "$detail" >>"$SUMMARY_FILE"
}

resolve_agent_browser() {
  if command -v agent-browser >/dev/null 2>&1; then
    AGENT_BROWSER_CMD=(agent-browser)
    return
  fi

  if command -v npx >/dev/null 2>&1 && npx --yes agent-browser --version >/dev/null 2>&1; then
    AGENT_BROWSER_CMD=(npx --yes agent-browser)
    return
  fi

  cat <<'MSG' >&2
agent-browser is required but not available.

Actionable options:
1. Install globally: npm install -g agent-browser
2. One-off run without global install: npx --yes agent-browser --help
3. Nix fallback: nix shell nixpkgs#nodejs -c npx --yes agent-browser --help
MSG

  exit 127
}

ab() {
  "${AGENT_BROWSER_CMD[@]}" --session "$SESSION_NAME" "$@"
}

ab_to_file() {
  local output_file="$1"
  shift
  local output_dir
  output_dir="$(dirname "$output_file")"
  mkdir -p "$output_dir"
  if ! ab "$@" >"$output_file" 2>&1; then
    CHECK_FAILURE_REASON="agent-browser command failed: $* (see $output_file)"
    return 1
  fi
  return 0
}

cleanup() {
  if [[ ${#AGENT_BROWSER_CMD[@]} -gt 0 ]]; then
    "${AGENT_BROWSER_CMD[@]}" --session "$SESSION_NAME" close >/dev/null 2>&1 || true
  fi
}

check_public_home() {
  local dir="$1"
  mkdir -p "$dir"

  ab_to_file "$dir/open.txt" open "$WEB_BASE_URL/" || return 1
  ab_to_file "$dir/wait.txt" wait --load "$WAIT_FOR_LOAD" || return 1
  ab_to_file "$dir/url.txt" get url || return 1
  ab_to_file "$dir/title.txt" get title || return 1
  ab_to_file "$dir/body.txt" get text body || return 1
  ab_to_file "$dir/snapshot.txt" snapshot -i || return 1
  ab_to_file "$dir/screenshot.txt" screenshot "$dir/screenshot.png" || return 1

  if ! grep -Eiq '(Studienbuch|Digitale|Roadmap|Anmelden)' "$dir/body.txt"; then
    CHECK_FAILURE_REASON="public page content markers not found in $dir/body.txt"
    return 1
  fi

  return 0
}

check_login_page() {
  local dir="$1"
  mkdir -p "$dir"

  ab_to_file "$dir/open.txt" open "$WEB_BASE_URL/login" || return 1
  ab_to_file "$dir/wait.txt" wait --load "$WAIT_FOR_LOAD" || return 1
  ab_to_file "$dir/url.txt" get url || return 1
  ab_to_file "$dir/body.txt" get text body || return 1
  ab_to_file "$dir/snapshot.txt" snapshot -i || return 1
  ab_to_file "$dir/screenshot.txt" screenshot "$dir/screenshot.png" || return 1

  if ! grep -Eiq 'Email' "$dir/snapshot.txt"; then
    CHECK_FAILURE_REASON="login check failed: missing Email field in snapshot"
    return 1
  fi

  if ! grep -Eiq 'Passwort' "$dir/snapshot.txt"; then
    CHECK_FAILURE_REASON="login check failed: missing Passwort field in snapshot"
    return 1
  fi

  if ! grep -Eiq 'Anmelden' "$dir/snapshot.txt"; then
    CHECK_FAILURE_REASON="login check failed: missing Anmelden submit marker in snapshot"
    return 1
  fi

  return 0
}

check_admin_guard_navigation() {
  local dir="$1"
  mkdir -p "$dir"

  ab_to_file "$dir/open.txt" open "$WEB_BASE_URL/admin" || return 1
  ab_to_file "$dir/wait.txt" wait --load "$WAIT_FOR_LOAD" || return 1
  ab_to_file "$dir/url.txt" get url || return 1
  ab_to_file "$dir/body.txt" get text body || return 1
  ab_to_file "$dir/snapshot.txt" snapshot -i || return 1
  ab_to_file "$dir/screenshot.txt" screenshot "$dir/screenshot.png" || return 1

  local final_url
  final_url="$(tr -d '[:space:]' <"$dir/url.txt")"

  if [[ "$final_url" == *"/login"* ]] || [[ "$final_url" == *"/login?"* ]]; then
    return 0
  fi

  if grep -Eiq '(Email|Passwort|Anmelden)' "$dir/snapshot.txt"; then
    return 0
  fi

  CHECK_FAILURE_REASON="admin navigation check failed: expected redirect/login guard, got '$final_url'"
  return 1
}

run_check() {
  local check_name="$1"
  local check_fn="$2"
  local check_dir="$ARTIFACT_DIR/$check_name"

  CHECK_FAILURE_REASON=""
  log "Running check: $check_name"

  set +e
  "$check_fn" "$check_dir"
  local exit_code=$?
  set -e

  if [[ $exit_code -eq 0 ]]; then
    append_summary "$check_name" "PASS" "ok"
    log "PASS: $check_name"
    return
  fi

  HAS_FAILURES=1
  append_summary "$check_name" "FAIL" "$CHECK_FAILURE_REASON"
  log "FAIL: $check_name ($CHECK_FAILURE_REASON)"
}

print_preconditions() {
  cat >"$PRECONDITIONS_FILE" <<EOF2
Preconditions:
- A local web instance is running and reachable at WEB_BASE_URL ($WEB_BASE_URL).
- The smoke is designed for a fresh unauthenticated browser session.
- agent-browser CLI is installed and executable.

Outputs:
- Run log: $LOG_FILE
- Summary table: $SUMMARY_FILE
- Per-check artifacts: $ARTIFACT_DIR/{public-home,login-page,admin-guard}
EOF2
}

main() {
  print_preconditions
  resolve_agent_browser
  trap cleanup EXIT

  log "Starting web/admin smoke run"
  log "WEB_BASE_URL=$WEB_BASE_URL"
  log "ARTIFACT_DIR=$ARTIFACT_DIR"
  log "SESSION_NAME=$SESSION_NAME"

  run_check "public-home" check_public_home
  run_check "login-page" check_login_page
  run_check "admin-guard" check_admin_guard_navigation

  if [[ $HAS_FAILURES -ne 0 ]]; then
    log "Smoke run finished with failures. See $SUMMARY_FILE and $LOG_FILE"
    exit 1
  fi

  log "Smoke run finished successfully. Artifacts: $ARTIFACT_DIR"
}

main "$@"

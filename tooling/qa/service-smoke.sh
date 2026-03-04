#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1091
. "$(dirname "$0")/common.sh"

root_dir="$(qa_repo_root)"
cd "$root_dir"
qa_load_env_files

run_dir="$(qa_ensure_run_dir)"
report_file="$run_dir/service-smoke.tsv"
curl_error_log="$run_dir/service-smoke-curl-errors.log"
printf "check\turl\thttp_code\tresult\n" >"$report_file"
: >"$curl_error_log"

api_endpoint="$(qa_api_endpoint)"
web_endpoint="$(qa_web_endpoint)"
admin_endpoint="$(qa_admin_endpoint)"
timeout_seconds="${QA_HTTP_TIMEOUT:-10}"
failures=0

run_http_check() {
  check_name="$1"
  url="$2"
  expected_csv="$3"
  curl_exit=0

  http_code="$(curl -sS -L -m "$timeout_seconds" -o /dev/null -w "%{http_code}" "$url" 2>>"$curl_error_log" || curl_exit=$?)"
  if [ "$curl_exit" -ne 0 ] || [ -z "$http_code" ]; then
    http_code="000"
  fi
  case ",$expected_csv," in
    *",$http_code,"*)
      result="PASS"
      ;;
    *)
      result="FAIL"
      failures=$((failures + 1))
      ;;
  esac

  printf "%s\t%s\t%s\t%s\n" "$check_name" "$url" "$http_code" "$result" >>"$report_file"
  printf "%s: %s (%s)\n" "$check_name" "$result" "$http_code"
}

run_http_check "api_healthz" "$(qa_join_url "$api_endpoint" "/healthz")" "200"
run_http_check "api_livez" "$(qa_join_url "$api_endpoint" "/livez")" "200"
run_http_check "web_root" "$(qa_join_url "$web_endpoint" "/")" "200,301,302,307,308"
run_http_check "admin_root" "$(qa_join_url "$admin_endpoint" "/")" "200,301,302,307,308"

if [ "$failures" -gt 0 ]; then
  printf "Service smoke checks failed (%s). Report: %s\n" "$failures" "$report_file" >&2
  exit 1
fi

printf "Service smoke checks passed. Report: %s\n" "$report_file"

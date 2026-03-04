#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1091
. "$(dirname "$0")/common.sh"

root_dir="$(qa_repo_root)"
cd "$root_dir"
qa_load_env_files

run_dir="$(qa_ensure_run_dir)"
report_file="$run_dir/mobile-ios-smoke.tsv"
maestro_log="$run_dir/ios-maestro-lifecycle.log"
ios_devices_log="$run_dir/ios-agent-device-devices.log"
ios_apps_log="$run_dir/ios-agent-device-apps.log"
ios_open_log="$run_dir/ios-agent-device-open.log"
ios_snapshot_log="$run_dir/ios-agent-device-snapshot.log"
ios_appstate_log="$run_dir/ios-agent-device-appstate.log"
ios_session="${IOS_SMOKE_SESSION:-qa-ios-smoke-$$}"

printf "check\tresult\tdetails\n" >"$report_file"
failures=0

record_result() {
  check_name="$1"
  result="$2"
  details="$3"
  printf "%s\t%s\t%s\n" "$check_name" "$result" "$details" >>"$report_file"
  printf "%s: %s (%s)\n" "$check_name" "$result" "$details"
}

MAESTRO_CMD=()
AGENT_DEVICE_CMD=()

resolve_maestro() {
  if command -v maestro >/dev/null 2>&1; then
    MAESTRO_CMD=(maestro)
    return
  fi

  if command -v nix >/dev/null 2>&1; then
    MAESTRO_CMD=(nix run nixpkgs#maestro --)
    return
  fi

  return 1
}

resolve_agent_device() {
  if command -v agent-device >/dev/null 2>&1; then
    AGENT_DEVICE_CMD=(agent-device)
    return
  fi

  if command -v npx >/dev/null 2>&1 && npx --yes agent-device --version >/dev/null 2>&1; then
    AGENT_DEVICE_CMD=(npx --yes agent-device)
    return
  fi

  if command -v nix >/dev/null 2>&1; then
    AGENT_DEVICE_CMD=(nix shell nixpkgs#nodejs -c npx --yes agent-device)
    return
  fi

  return 1
}

cleanup_agent_device_session() {
  if [ "${#AGENT_DEVICE_CMD[@]}" -gt 0 ]; then
    "${AGENT_DEVICE_CMD[@]}" --session "$ios_session" close >/dev/null 2>&1 || true
  fi
}

run_maestro_lifecycle() {
  if ! resolve_maestro; then
    record_result "maestro_available" "FAIL" "Install maestro or run with nix available (nix run nixpkgs#maestro -- --version)"
    failures=$((failures + 1))
    return
  fi

  record_result "maestro_available" "PASS" "${MAESTRO_CMD[*]}"

  if "${MAESTRO_CMD[@]}" --version >"$run_dir/ios-maestro-version.log" 2>&1; then
    :
  else
    record_result "maestro_version" "FAIL" "Failed to execute ${MAESTRO_CMD[*]} --version"
    failures=$((failures + 1))
    return
  fi

  if bun --filter @stu/app-mobile maestro:test:lifecycle >"$maestro_log" 2>&1; then
    record_result "maestro_lifecycle" "PASS" "bun --filter @stu/app-mobile maestro:test:lifecycle"
  else
    record_result "maestro_lifecycle" "FAIL" "See $maestro_log and ~/.maestro/tests"
    failures=$((failures + 1))
  fi
}

run_agent_device_probe() {
  if ! resolve_agent_device; then
    record_result "agent_device_available" "FAIL" "Install agent-device or ensure npx/nix is available"
    failures=$((failures + 1))
    return
  fi

  record_result "agent_device_available" "PASS" "${AGENT_DEVICE_CMD[*]}"

  if "${AGENT_DEVICE_CMD[@]}" --session "$ios_session" devices --platform ios >"$ios_devices_log" 2>&1; then
    if grep -qi "simulator" "$ios_devices_log"; then
      record_result "ios_device_list" "PASS" "iOS simulator detected"
    else
      record_result "ios_device_list" "FAIL" "No iOS simulator detected (see $ios_devices_log)"
      failures=$((failures + 1))
      return
    fi
  else
    record_result "ios_device_list" "FAIL" "Failed to list iOS devices (see $ios_devices_log)"
    failures=$((failures + 1))
    return
  fi

  if "${AGENT_DEVICE_CMD[@]}" --session "$ios_session" apps --platform ios --json >"$ios_apps_log" 2>&1; then
    if grep -Eq 'dev\.schnau\.studienbuch\.dev|Studienbuch \(Dev\)' "$ios_apps_log"; then
      record_result "ios_app_installed" "PASS" "Studienbuch (Dev) found"
    else
      record_result "ios_app_installed" "FAIL" "Studienbuch (Dev) is not installed (see $ios_apps_log)"
      failures=$((failures + 1))
      return
    fi
  else
    record_result "ios_app_installed" "FAIL" "Failed to list iOS apps (see $ios_apps_log)"
    failures=$((failures + 1))
    return
  fi

  if "${AGENT_DEVICE_CMD[@]}" --session "$ios_session" open "Studienbuch (Dev)" --platform ios --relaunch >"$ios_open_log" 2>&1; then
    if "${AGENT_DEVICE_CMD[@]}" --session "$ios_session" appstate --json >"$ios_appstate_log" 2>&1; then
      :
    else
      record_result "ios_dogfood_probe" "FAIL" "App opened but appstate failed (see $ios_appstate_log)"
      failures=$((failures + 1))
      return
    fi

    if "${AGENT_DEVICE_CMD[@]}" --session "$ios_session" snapshot -i >"$ios_snapshot_log" 2>&1; then
      if grep -Eq 'ready|mode:enabled|Studienbuch' "$ios_snapshot_log"; then
        record_result "ios_dogfood_probe" "PASS" "Open + snapshot succeeded"
      else
        record_result "ios_dogfood_probe" "FAIL" "Unexpected UI snapshot content (see $ios_snapshot_log)"
        failures=$((failures + 1))
      fi
    else
      record_result "ios_dogfood_probe" "FAIL" "Snapshot failed (see $ios_snapshot_log)"
      failures=$((failures + 1))
    fi
  else
    if grep -q "DEVICE_IN_USE" "$ios_open_log"; then
      record_result "ios_dogfood_probe" "FAIL" "Open failed: simulator locked by another agent-device session (see $ios_open_log)"
    else
      record_result "ios_dogfood_probe" "FAIL" "Open failed (see $ios_open_log)"
    fi
    failures=$((failures + 1))
  fi
}

trap cleanup_agent_device_session EXIT

run_maestro_lifecycle
run_agent_device_probe

if [ "$failures" -gt 0 ]; then
  printf "iOS mobile smoke checks failed (%s). Report: %s\n" "$failures" "$report_file" >&2
  exit 1
fi

printf "iOS mobile smoke checks passed. Report: %s\n" "$report_file"

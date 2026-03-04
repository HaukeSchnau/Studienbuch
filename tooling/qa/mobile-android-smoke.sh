#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1091
. "$(dirname "$0")/common.sh"

root_dir="$(qa_repo_root)"
cd "$root_dir"
qa_load_env_files

run_dir="$(qa_ensure_run_dir)"
report_file="$run_dir/mobile-android-smoke.tsv"
maestro_log="$run_dir/android-maestro-lifecycle.log"
adb_devices_log="$run_dir/android-adb-devices.log"
android_devices_log="$run_dir/android-agent-device-devices.log"
android_apps_log="$run_dir/android-agent-device-apps.log"
android_open_log="$run_dir/android-agent-device-open.log"
android_snapshot_log="$run_dir/android-agent-device-snapshot.log"
android_appstate_log="$run_dir/android-agent-device-appstate.log"
android_session="${ANDROID_SMOKE_SESSION:-qa-android-smoke-$$}"
android_app_id="${ANDROID_SMOKE_APP_ID:-dev.schnau.studienbuch.dev}"

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
ADB_CMD=()

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

resolve_adb() {
  if command -v adb >/dev/null 2>&1; then
    ADB_CMD=(adb)
    return
  fi

  if command -v nix >/dev/null 2>&1; then
    ADB_CMD=(nix shell nixpkgs#android-tools -c adb)
    return
  fi

  return 1
}

resolve_agent_device() {
  if command -v agent-device >/dev/null 2>&1 && command -v adb >/dev/null 2>&1; then
    AGENT_DEVICE_CMD=(agent-device)
    return
  fi

  if command -v npx >/dev/null 2>&1 && command -v adb >/dev/null 2>&1 && npx --yes agent-device --version >/dev/null 2>&1; then
    AGENT_DEVICE_CMD=(npx --yes agent-device)
    return
  fi

  if command -v nix >/dev/null 2>&1; then
    AGENT_DEVICE_CMD=(nix shell nixpkgs#nodejs nixpkgs#android-tools -c npx --yes agent-device)
    return
  fi

  return 1
}

cleanup_agent_device_session() {
  if [ "${#AGENT_DEVICE_CMD[@]}" -gt 0 ]; then
    "${AGENT_DEVICE_CMD[@]}" --session "$android_session" close >/dev/null 2>&1 || true
  fi
}

run_maestro_lifecycle() {
  if ! resolve_maestro; then
    record_result "maestro_available" "FAIL" "Install maestro or run with nix available (nix run nixpkgs#maestro -- --version)"
    failures=$((failures + 1))
    return
  fi

  record_result "maestro_available" "PASS" "${MAESTRO_CMD[*]}"

  if "${MAESTRO_CMD[@]}" --version >"$run_dir/android-maestro-version.log" 2>&1; then
    :
  else
    record_result "maestro_version" "FAIL" "Failed to execute ${MAESTRO_CMD[*]} --version"
    failures=$((failures + 1))
    return
  fi

  if MAESTRO_PLATFORM=android bun --filter @stu/app-mobile maestro:test:lifecycle >"$maestro_log" 2>&1; then
    record_result "maestro_lifecycle" "PASS" "MAESTRO_PLATFORM=android bun --filter @stu/app-mobile maestro:test:lifecycle"
  else
    record_result "maestro_lifecycle" "FAIL" "See $maestro_log and ~/.maestro/tests"
    failures=$((failures + 1))
  fi
}

run_android_probe() {
  if ! resolve_adb; then
    record_result "adb_available" "FAIL" "Install adb or run with nix available (nix shell nixpkgs#android-tools -c adb version)"
    failures=$((failures + 1))
    return
  fi

  record_result "adb_available" "PASS" "${ADB_CMD[*]}"

  if "${ADB_CMD[@]}" devices -l >"$adb_devices_log" 2>&1; then
    if grep -Eq '^emulator-|[[:space:]]device([[:space:]]|$)' "$adb_devices_log"; then
      record_result "android_adb_devices" "PASS" "Android device/emulator detected"
    else
      record_result "android_adb_devices" "FAIL" "No Android device/emulator detected (see $adb_devices_log)"
      failures=$((failures + 1))
      return
    fi
  else
    record_result "android_adb_devices" "FAIL" "Failed to list adb devices (see $adb_devices_log)"
    failures=$((failures + 1))
    return
  fi

  if ! resolve_agent_device; then
    record_result "agent_device_available" "FAIL" "Install agent-device or ensure npx/nix is available"
    failures=$((failures + 1))
    return
  fi

  record_result "agent_device_available" "PASS" "${AGENT_DEVICE_CMD[*]}"

  if "${AGENT_DEVICE_CMD[@]}" --session "$android_session" devices --platform android >"$android_devices_log" 2>&1; then
    if grep -Eqi 'android|emulator' "$android_devices_log"; then
      record_result "android_device_list" "PASS" "Android target detected"
    else
      record_result "android_device_list" "FAIL" "No Android targets in agent-device output (see $android_devices_log)"
      failures=$((failures + 1))
      return
    fi
  else
    record_result "android_device_list" "FAIL" "Failed to list Android targets (see $android_devices_log)"
    failures=$((failures + 1))
    return
  fi

  if "${AGENT_DEVICE_CMD[@]}" --session "$android_session" apps --platform android --json >"$android_apps_log" 2>&1; then
    if grep -Eq "$android_app_id|Studienbuch" "$android_apps_log"; then
      record_result "android_app_installed" "PASS" "$android_app_id found"
    else
      record_result "android_app_installed" "FAIL" "$android_app_id not installed (see $android_apps_log)"
      failures=$((failures + 1))
      return
    fi
  else
    record_result "android_app_installed" "FAIL" "Failed to list Android apps (see $android_apps_log)"
    failures=$((failures + 1))
    return
  fi

  if "${AGENT_DEVICE_CMD[@]}" --session "$android_session" open "$android_app_id" --platform android --relaunch >"$android_open_log" 2>&1; then
    if "${AGENT_DEVICE_CMD[@]}" --session "$android_session" appstate --json >"$android_appstate_log" 2>&1; then
      :
    else
      record_result "android_dogfood_probe" "FAIL" "App opened but appstate failed (see $android_appstate_log)"
      failures=$((failures + 1))
      return
    fi

    if "${AGENT_DEVICE_CMD[@]}" --session "$android_session" snapshot -i >"$android_snapshot_log" 2>&1; then
      if grep -Eq 'ready|mode:enabled|Studienbuch' "$android_snapshot_log"; then
        record_result "android_dogfood_probe" "PASS" "Open + snapshot succeeded"
      else
        record_result "android_dogfood_probe" "FAIL" "Unexpected UI snapshot content (see $android_snapshot_log)"
        failures=$((failures + 1))
      fi
    else
      record_result "android_dogfood_probe" "FAIL" "Snapshot failed (see $android_snapshot_log)"
      failures=$((failures + 1))
    fi
  else
    if grep -q "DEVICE_IN_USE" "$android_open_log"; then
      record_result "android_dogfood_probe" "FAIL" "Open failed: emulator locked by another agent-device session (see $android_open_log)"
    else
      record_result "android_dogfood_probe" "FAIL" "Open failed (see $android_open_log)"
    fi
    failures=$((failures + 1))
  fi
}

trap cleanup_agent_device_session EXIT

run_maestro_lifecycle
run_android_probe

if [ "$failures" -gt 0 ]; then
  printf "Android mobile smoke checks failed (%s). Report: %s\n" "$failures" "$report_file" >&2
  exit 1
fi

printf "Android mobile smoke checks passed. Report: %s\n" "$report_file"

#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1091
. "$(dirname "$0")/common.sh"

root_dir="$(qa_repo_root)"
cd "$root_dir"
qa_load_env_files

run_dir="$(qa_ensure_run_dir)"
captured_at="$(qa_timestamp_iso_utc)"

jj_change_id=""
jj_commit_id=""
if command -v jj >/dev/null 2>&1; then
  jj_change_id="$(jj log -r @ --no-graph -T 'change_id.short()' 2>/dev/null | sed -n '1p' | tr -d '\r')"
  jj_commit_id="$(jj log -r @ --no-graph -T 'commit_id.short()' 2>/dev/null | sed -n '1p' | tr -d '\r')"
fi

git_head=""
if command -v git >/dev/null 2>&1; then
  git_head="$(git rev-parse --short HEAD 2>/dev/null || true)"
fi

platform_os="$(uname -s)"
platform_release="$(uname -r)"
platform_arch="$(uname -m)"
platform_host="$(uname -n)"
device_name="${QA_DEVICE:-$platform_host}"

api_endpoint="$(qa_api_endpoint)"
web_endpoint="$(qa_web_endpoint)"
admin_endpoint="$(qa_admin_endpoint)"

fingerprint_input_file="$run_dir/env-fingerprint-input.txt"
cat >"$fingerprint_input_file" <<EOF
captured_at=$captured_at
platform_os=$platform_os
platform_release=$platform_release
platform_arch=$platform_arch
platform_host=$platform_host
device_name=$device_name
node_env=${NODE_ENV:-}
api_port=${API_PORT:-}
stu_api_port=${STU_API_PORT:-}
stu_nextjs_port=${STU_NEXTJS_PORT:-}
stu_admin_panel_port=${STU_ADMIN_PANEL_PORT:-}
api_endpoint=$api_endpoint
web_endpoint=$web_endpoint
admin_endpoint=$admin_endpoint
EOF

if command -v bun >/dev/null 2>&1; then
  printf "bun_version=%s\n" "$(bun --version 2>/dev/null || true)" >>"$fingerprint_input_file"
fi
if command -v just >/dev/null 2>&1; then
  printf "just_version=%s\n" "$(just --version 2>/dev/null || true)" >>"$fingerprint_input_file"
fi
if command -v nix >/dev/null 2>&1; then
  printf "nix_version=%s\n" "$(nix --version 2>/dev/null || true)" >>"$fingerprint_input_file"
fi

env_fingerprint="$(qa_hash_file "$fingerprint_input_file")"

metadata_file="$run_dir/run-metadata.env"
cat >"$metadata_file" <<EOF
QA_RUN_DIR=$run_dir
QA_CAPTURED_AT=$captured_at
QA_JJ_CHANGE_ID=$jj_change_id
QA_JJ_COMMIT_ID=$jj_commit_id
QA_GIT_HEAD=$git_head
QA_PLATFORM_OS=$platform_os
QA_PLATFORM_RELEASE=$platform_release
QA_PLATFORM_ARCH=$platform_arch
QA_PLATFORM_HOST=$platform_host
QA_DEVICE=$device_name
QA_ENV_FINGERPRINT=$env_fingerprint
QA_ENV_FINGERPRINT_SOURCE=$fingerprint_input_file
QA_API_ENDPOINT=$api_endpoint
QA_WEB_ENDPOINT=$web_endpoint
QA_ADMIN_ENDPOINT=$admin_endpoint
EOF

printf "Captured run metadata: %s\n" "$metadata_file"

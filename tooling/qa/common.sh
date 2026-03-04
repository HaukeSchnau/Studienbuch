#!/usr/bin/env bash
set -euo pipefail

qa_script_dir() {
  CDPATH= cd -- "$(dirname -- "$0")" && pwd
}

qa_repo_root() {
  CDPATH= cd -- "$(qa_script_dir)/../.." && pwd
}

qa_timestamp_compact_utc() {
  date -u +"%Y%m%dT%H%M%SZ"
}

qa_timestamp_iso_utc() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

qa_artifacts_base() {
  printf "%s/.artifacts/qa\n" "$(qa_repo_root)"
}

qa_init_campaign_dir() {
  if [ -n "${QA_CAMPAIGN_TIMESTAMP:-}" ]; then
    timestamp="$QA_CAMPAIGN_TIMESTAMP"
    run_dir="$(qa_artifacts_base)/$timestamp"
    if [ -e "$run_dir" ]; then
      echo "QA campaign directory already exists: $run_dir" >&2
      echo "Choose a different QA_CAMPAIGN_TIMESTAMP or remove the existing directory." >&2
      exit 1
    fi
  else
    while :; do
      timestamp="$(qa_timestamp_compact_utc)"
      run_dir="$(qa_artifacts_base)/$timestamp"
      if [ ! -e "$run_dir" ]; then
        break
      fi
      sleep 1
    done
  fi

  mkdir -p "$run_dir"
  printf "%s\n" "$run_dir"
}

qa_ensure_run_dir() {
  if [ -n "${QA_RUN_DIR:-}" ]; then
    mkdir -p "$QA_RUN_DIR"
    printf "%s\n" "$QA_RUN_DIR"
    return
  fi

  qa_init_campaign_dir
}

qa_load_env_files() {
  root_dir="$(qa_repo_root)"

  set -a
  if [ -f "$root_dir/.env" ]; then
    # shellcheck disable=SC1090
    . "$root_dir/.env"
  fi
  if [ -f "$root_dir/.env.secrets" ]; then
    # shellcheck disable=SC1090
    . "$root_dir/.env.secrets"
  fi
  set +a
}

qa_default_api_endpoint() {
  api_port="${STU_API_PORT:-${API_PORT:-3001}}"
  printf "http://localhost:%s\n" "$api_port"
}

qa_default_web_endpoint() {
  web_port="${STU_NEXTJS_PORT:-3000}"
  printf "http://localhost:%s\n" "$web_port"
}

qa_default_admin_endpoint() {
  admin_port="${STU_ADMIN_PANEL_PORT:-3002}"
  printf "http://localhost:%s\n" "$admin_port"
}

qa_api_endpoint() {
  printf "%s\n" "${QA_API_ENDPOINT:-${API_BASE_URL:-$(qa_default_api_endpoint)}}"
}

qa_web_endpoint() {
  printf "%s\n" "${QA_WEB_ENDPOINT:-${WEB_BASE_URL:-$(qa_default_web_endpoint)}}"
}

qa_admin_endpoint() {
  printf "%s\n" "${QA_ADMIN_ENDPOINT:-${ADMIN_BASE_URL:-$(qa_default_admin_endpoint)}}"
}

qa_join_url() {
  base="${1%/}"
  path="$2"
  printf "%s%s\n" "$base" "$path"
}

qa_hash_file() {
  file_path="$1"

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file_path" | awk '{print $1}'
    return
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file_path" | awk '{print $1}'
    return
  fi
  if command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$file_path" | awk '{print $NF}'
    return
  fi

  cksum "$file_path" | awk '{print $1}'
}

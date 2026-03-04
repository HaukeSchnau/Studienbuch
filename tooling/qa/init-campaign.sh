#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1091
. "$(dirname "$0")/common.sh"

root_dir="$(qa_repo_root)"
cd "$root_dir"

run_dir="$(qa_init_campaign_dir)"
printf "%s\n" "$run_dir"

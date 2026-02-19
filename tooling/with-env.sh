#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ $# -eq 0 ]]; then
  echo "Usage: tooling/with-env.sh <command> [args...]" >&2
  exit 64
fi

set -a
if [[ -f ./.env ]]; then
  # shellcheck disable=SC1091
  source ./.env
fi
if [[ -f ./.env.secrets ]]; then
  # shellcheck disable=SC1091
  source ./.env.secrets
fi
set +a

exec "$@"

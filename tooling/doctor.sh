#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

failures=0

ok() {
  printf "[ok] %s\n" "$1"
}

fail() {
  printf "[fail] %s\n" "$1" >&2
  failures=$((failures + 1))
}

check_cmd() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    ok "command available: $cmd"
  else
    fail "missing command: $cmd"
  fi
}

check_port_free() {
  local name="$1"
  local port="$2"
  if [[ ! "$port" =~ ^[0-9]+$ ]]; then
    fail "$name must be numeric (got '$port')"
    return
  fi

  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    fail "$name port $port is already in use"
  else
    ok "$name port $port is free"
  fi
}

check_http_reachable() {
  local label="$1"
  local url="$2"
  local codes_csv="$3"
  local code

  code="$(curl -sS -o /dev/null -m 10 -w "%{http_code}" "$url" || true)"

  if [[ ",$codes_csv," == *",$code,"* ]]; then
    ok "$label reachable (HTTP $code)"
  else
    fail "$label unreachable or unexpected status (HTTP ${code:-n/a})"
  fi
}

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

echo "== Tooling =="
check_cmd bun
check_cmd nix
check_cmd docker
check_cmd just
check_cmd curl
check_cmd lsof

if docker info >/dev/null 2>&1; then
  ok "docker daemon reachable"
else
  fail "docker daemon is not reachable"
fi

if docker compose version >/dev/null 2>&1; then
  ok "docker compose available"
else
  fail "docker compose plugin missing"
fi

echo "\n== Environment =="
required_vars=(
  NEXT_PUBLIC_AXIOM_DATASET
  NEXT_PUBLIC_AXIOM_TOKEN
  LINEAR_API_KEY
  UNTIS_KADMOS_NAME
  UNTIS_KADMOS_USERNAME
  UNTIS_KADMOS_PASSWORD
  MANAGEMENT_DATABASE_URL
  LEGACY_DATABASE_URL
  PULSAR_URL
  API_PORT
)

for key in "${required_vars[@]}"; do
  if [[ -n "${!key:-}" ]]; then
    ok "$key is set"
  else
    fail "$key is missing"
  fi
done

echo "\n== Compose Config =="
if ./tooling/with-env.sh docker compose --profile live -f docker-compose.yml config >/dev/null 2>&1; then
  ok "docker-compose.yml resolves with current env"
else
  fail "docker-compose.yml has unresolved or invalid configuration"
fi

if ./tooling/with-env.sh docker compose --profile live -f docker-compose.yml -f docker-compose.dev.yml config >/dev/null 2>&1; then
  ok "docker-compose.dev.yml resolves with current env"
else
  fail "docker-compose.dev.yml has unresolved or invalid configuration"
fi

if ./tooling/with-env.sh docker compose --profile live -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.debug-ports.yml config >/dev/null 2>&1; then
  ok "docker-compose.debug-ports.yml resolves with current env"
else
  fail "docker-compose.debug-ports.yml has unresolved or invalid configuration"
fi

echo "\n== Port Availability =="
check_port_free STU_API_PORT "${STU_API_PORT:-3001}"
check_port_free STU_NEXTJS_PORT "${STU_NEXTJS_PORT:-3000}"
check_port_free STU_ADMIN_PANEL_PORT "${STU_ADMIN_PANEL_PORT:-3002}"

echo "\n== External Reachability =="
check_http_reachable "Linear API" "https://api.linear.app/graphql" "200,400,401,405"
check_http_reachable "Axiom API" "https://api.axiom.co" "200,301,302,307,308,401,403,404"

if [[ $failures -gt 0 ]]; then
  echo "\nDoctor found $failures issue(s)." >&2
  exit 1
fi

echo "\nDoctor checks passed."

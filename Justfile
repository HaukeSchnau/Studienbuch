[private]
_oci-preload:
    nix run .#oci-export-archives
    nix run .#oci-load-archives

dev:
    just _oci-preload
    ./tooling/with-env.sh docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --no-build --remove-orphans
    open http://localhost:8081/_expo/plugins/expo-drizzle-studio-plugin
    open https://local.drizzle.studio/
    mprocs # See: mprocs.yaml, https://github.com/mirage-js/mprocs  
    # Clean up after dev
    ./tooling/with-env.sh docker compose -f docker-compose.yml -f docker-compose.dev.yml down

console *ARGS:
    ./tooling/with-env.sh bun packages/console/src/console.ts {{ARGS}}

clone-prod-db:
    set -eu; \
    if [ -f ./.env ]; then set -a; . ./.env; set +a; fi; \
    if [ -f ./.env.secrets ]; then set -a; . ./.env.secrets; set +a; fi; \
    node_env="$${NODE_ENV:-development}"; \
    host="$$(hostname)"; \
    if echo "$$host" | grep -q "server" || [ "$$node_env" = "production" ]; then \
      echo "This command is not intended to run on production hosts."; \
      exit 1; \
    fi; \
    dropdb studienbuch; \
    createdb studienbuch; \
    ssh studienbuch@schnau.dev "pg_dump" | psql studienbuch

visualize-deps:
    bun tooling/visualize-deps.ts

seed: 
    just console pull igs-lil

check:
    bun run typecheck
    bun run lint:fix

doctor:
    ./tooling/doctor.sh

[working-directory: 'packages/app-mobile']
ios:
    bun run expo run:ios

install:
    bun install

install-clean:
    find . -name "node_modules" -type d -exec rm -rf {} +
    bun install

stats:
    nix develop -c cloc $(git ls-files .)

nix-build-api:
    nix run .#build-api

nix-build-console:
    nix run .#build-console

nix-dev:
    nix develop

nix-build-all:
    nix run .#build-all

nix-start-api:
    nix run .#start-api

nix-start-console *ARGS:
    nix run .#start-console -- {{ARGS}}

nix-migrate *ARGS:
    nix run .#migrations -- {{ARGS}}

oci-export *ARGS:
    nix run .#oci-export-archives -- {{ARGS}}

oci-load:
    nix run .#oci-load-archives

live-up:
    just _oci-preload
    ./tooling/with-env.sh docker compose --profile live -f docker-compose.yml up -d --no-build --remove-orphans

live-up-dev:
    just _oci-preload
    ./tooling/with-env.sh docker compose --profile live -f docker-compose.yml -f docker-compose.dev.yml up -d --no-build --remove-orphans

live-down:
    ./tooling/with-env.sh docker compose --profile live -f docker-compose.yml down -v

live-logs *ARGS:
    ./tooling/with-env.sh docker compose --profile live -f docker-compose.yml logs {{ARGS}}

live-health:
    curl -fsS "http://localhost:{{ env_var_or_default('STU_API_PORT', '3001') }}/healthz"

nix-smoke:
    log=$$(mktemp); \
    ( \
      if [ -f ./.env ]; then set -a; . ./.env; set +a; fi; \
      if [ -f ./.env.secrets ]; then set -a; . ./.env.secrets; set +a; fi; \
      SKIP_ENV_VALIDATION=1 \
      NODE_ENV=development \
      MANAGEMENT_DATABASE_URL=postgresql://stu:stu@localhost:5432/stu \
      PULSAR_URL=rabbitmq-stream://localhost:5552 \
      API_PORT=3001 \
      NEXT_PUBLIC_AXIOM_DATASET="$${NEXT_PUBLIC_AXIOM_DATASET:?NEXT_PUBLIC_AXIOM_DATASET is required}" \
      NEXT_PUBLIC_AXIOM_TOKEN="$${NEXT_PUBLIC_AXIOM_TOKEN:?NEXT_PUBLIC_AXIOM_TOKEN is required}" \
      nix run .#start-api >"$$log" 2>&1 & \
      pid=$$!; \
      sleep 12; \
      if kill -0 "$$pid" 2>/dev/null; then kill "$$pid"; fi; \
      wait "$$pid" 2>/dev/null || true \
    ); \
    sed -n '1,120p' "$$log"; \
    rm -f "$$log"
    clog=$$(mktemp); \
    ( \
      if [ -f ./.env ]; then set -a; . ./.env; set +a; fi; \
      if [ -f ./.env.secrets ]; then set -a; . ./.env.secrets; set +a; fi; \
      SKIP_ENV_VALIDATION=1 \
      NODE_ENV=development \
      MANAGEMENT_DATABASE_URL=postgresql://stu:stu@localhost:5432/stu \
      LEGACY_DATABASE_URL=postgresql://stu:stu@localhost:5433/postgres \
      NEXT_PUBLIC_AXIOM_DATASET="$${NEXT_PUBLIC_AXIOM_DATASET:?NEXT_PUBLIC_AXIOM_DATASET is required}" \
      NEXT_PUBLIC_AXIOM_TOKEN="$${NEXT_PUBLIC_AXIOM_TOKEN:?NEXT_PUBLIC_AXIOM_TOKEN is required}" \
      nix run .#start-console -- --help >"$$clog" 2>&1 & \
      pid=$$!; \
      sleep 8; \
      if kill -0 "$$pid" 2>/dev/null; then kill "$$pid"; fi; \
      wait "$$pid" 2>/dev/null || true \
    ); \
    sed -n '1,120p' "$$clog"; \
    rm -f "$$clog"

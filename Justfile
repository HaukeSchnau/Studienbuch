[private]
_oci-preload:
    if [ "${SKIP_OCI_PRELOAD:-0}" = "1" ]; then \
      missing=0; \
      for image in \
        studienbuch-api:nix \
        studienbuch-nextjs:nix \
        studienbuch-admin-panel:nix \
        studienbuch-console-cron:nix \
        studienbuch-migrations:nix; do \
        if docker image inspect "$image" >/dev/null 2>&1; then \
          echo "OCI image present: $image"; \
        else \
          echo "Missing OCI image: $image" >&2; \
          missing=1; \
        fi; \
      done; \
      if [ "$missing" -eq 1 ]; then \
        echo "SKIP_OCI_PRELOAD=1 requires preloaded OCI images. Run 'just oci-load' (or 'just oci-build && just oci-load') first." >&2; \
        exit 1; \
      fi; \
      echo "Skipping OCI preload (SKIP_OCI_PRELOAD=1)."; \
    else \
      just oci-load; \
    fi

[private]
_preflight-doctor:
    if [ "${SKIP_DOCTOR:-0}" = "1" ]; then \
      echo "Skipping doctor preflight (SKIP_DOCTOR=1)."; \
    else \
      just doctor; \
    fi

dev:
    just _preflight-doctor
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

[parallel]
check: check-fmt check-lint

qa: check test

qa-campaign-init:
    ./tooling/qa/init-campaign.sh

qa-capture-run-metadata:
    ./tooling/qa/capture-run-metadata.sh

qa-smoke-services:
    ./tooling/qa/service-smoke.sh

qa-smoke-console:
    ./tooling/qa/console-smoke.sh

qa-smoke-web-admin:
    ./tooling/qa/web-admin/smoke-navigation.sh

qa-smoke-run:
    ./tooling/qa/run-smoke.sh

check-fmt:
    bun run checks:fmt

check-lint:
    bun run checks:lint:fix-safe

test:
    bun run test

doctor:
    ./tooling/doctor.sh

[working-directory: 'packages/app-mobile']
ios:
    bun run expo run:ios

install:
    bun install

stats:
    nix develop -c cloc $(git ls-files .)

nix-build-api:
    nix run .#build-api

nix-build-console:
    nix run .#build-console

nix-dev:
    nix develop

nix-builder-health:
    nix store ping --store ssh-ng://haukeschnau@netcup-vps:2222
    nix build -L --no-link --impure --expr 'let flake = builtins.getFlake "nixpkgs"; pkgs = import flake.outPath { system = "aarch64-linux"; }; in pkgs.runCommand "studienbuch-remote-builder-health" {} "echo ok > $out"' --extra-experimental-features 'nix-command flakes'

nix-build-all:
    nix run .#build-all

nix-start-api:
    nix run .#start-api

nix-start-console *ARGS:
    nix run .#start-console -- {{ARGS}}

nix-migrate *ARGS:
    nix run .#migrations -- {{ARGS}}

oci-build:
    set -eu; \
    for attr in \
      .#packages.aarch64-linux.oci-api-archive \
      .#packages.aarch64-linux.oci-console-cron-archive \
      .#packages.aarch64-linux.oci-migrations-archive \
      .#packages.aarch64-linux.oci-nextjs-archive \
      .#packages.aarch64-linux.oci-admin-panel-archive; do \
      echo "Building $attr"; \
      nix build --no-link "$attr"; \
    done

oci-inspect:
    nix shell nixpkgs#skopeo nixpkgs#jq -c sh -c '\
      set -eu; \
      api=$(nix path-info .#packages.aarch64-linux.oci-api-archive); \
      console=$(nix path-info .#packages.aarch64-linux.oci-console-cron-archive); \
      migrations=$(nix path-info .#packages.aarch64-linux.oci-migrations-archive); \
      nextjs=$(nix path-info .#packages.aarch64-linux.oci-nextjs-archive); \
      admin=$(nix path-info .#packages.aarch64-linux.oci-admin-panel-archive); \
      for p in "$api" "$console" "$migrations" "$nextjs" "$admin"; do \
        name=$(basename "$p"); \
        layers=$(skopeo inspect "oci-archive:$p" | jq -r ".Layers | length"); \
        digest=$(skopeo inspect "oci-archive:$p" | jq -r ".Digest"); \
        echo "$name layers=$layers digest=$digest"; \
      done'

oci-export *ARGS:
    nix run .#oci-export-archives {{ARGS}}

oci-load *ARGS:
    nix run .#oci-load-archives {{ARGS}}

live-up:
    just _preflight-doctor
    just _oci-preload
    ./tooling/with-env.sh docker compose --profile live -f docker-compose.yml up -d --no-build --remove-orphans

live-up-dev:
    just _preflight-doctor
    just _oci-preload
    ./tooling/with-env.sh docker compose --profile live -f docker-compose.yml -f docker-compose.dev.yml up -d --no-build --remove-orphans

live-up-dev-debug:
    just _preflight-doctor
    just _oci-preload
    ./tooling/with-env.sh docker compose --profile live -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.debug-ports.yml up -d --no-build --remove-orphans

live-down:
    ./tooling/with-env.sh docker compose --profile live -f docker-compose.yml down -v

live-logs *ARGS:
    ./tooling/with-env.sh docker compose --profile live -f docker-compose.yml logs {{ARGS}}

live-health:
    ./tooling/with-env.sh docker compose --profile live -f docker-compose.yml exec -T console-cron sh -lc 'wget -qO- http://api:80/healthz'

live-health-web:
    ./tooling/with-env.sh docker compose --profile live -f docker-compose.yml exec -T console-cron sh -lc 'wget -qO- http://nextjs:80/ >/dev/null'
    ./tooling/with-env.sh docker compose --profile live -f docker-compose.yml exec -T console-cron sh -lc 'wget -qO- http://admin-panel:80/ >/dev/null'

live-health-all:
    just live-health
    just live-health-web

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

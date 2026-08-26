set unstable
set lists

[parallel]
qa-tasks: lint mobile-e2e-check test-package-libraries test-server test-apps web-lock-check

qa: fmt-check qa-tasks
fix: fmt lint-fix

doctor:
    react-doctor

fmt:
    vp fmt

fmt-check:
    vp fmt --check

lint:
    vp lint --report-unused-disable-directives

lint-fix:
    vp lint --report-unused-disable-directives --fix

# Keep the package and application selections separate: with the whole workspace selected at once,
# Vite+ drops @stu/web whenever its package dependencies are in the same task graph. The independent
# selections run concurrently; QA also starts the server suite immediately instead of waiting for
# the library packages.
[parallel]
test: test-packages test-apps

[parallel]
test-packages: test-package-libraries test-server

test-package-libraries:
    vp run --filter "@stu/core" --filter "@stu/observability" test

test-server:
    vp run --filter "@stu/server" test

test-apps:
    vp run --filter "./apps/*" test

db-generate:
    vp run --filter "@stu/server" db:generate

db-migrate:
    vp run --filter "@stu/server" db:migrate

db-diagram:
    #!/usr/bin/env bash
    set -euo pipefail
    diagram_tmp="$(mktemp -d)"
    trap 'rm -rf "$diagram_tmp"' EXIT
    atlas_format='{''{ mermaid . }''}'

    cd packages/server
    DATABASE_URL="${DATABASE_URL:-postgresql://diagram:diagram@diagram.invalid/diagram}" \
        pnpm --silent exec drizzle-kit export --config=drizzle.config.ts > "$diagram_tmp/schema.sql"
    atlas schema inspect \
        --url "file://$diagram_tmp/schema.sql" \
        --dev-url "docker://postgres/17/dev?search_path=public" \
        --format "$atlas_format" > "$diagram_tmp/schema.mmd"
    mmdc \
        --input "$diagram_tmp/schema.mmd" \
        --output "$diagram_tmp/schema.svg" \
        --backgroundColor transparent

    install -m 0644 "$diagram_tmp/schema.mmd" ../../docs/database-schema.mmd
    install -m 0644 "$diagram_tmp/schema.svg" ../../docs/database-schema.svg

icons:
    node scripts/generate-icons.ts

install:
    pnpm install

clean:
    vp run -r clean
    rm -rf node_modules .vite-plus apps/*/node_modules apps/*/.vite-plus packages/*/node_modules packages/*/.vite-plus scripts/node_modules
    just install

dev app options="":
    vp run --filter "./apps/{{app}}" dev -- {{options}}

build app:
    vp run --filter "./apps/{{app}}" build

start app:
    vp run --filter "./apps/{{app}}" start

console *args:
    project dev console {{ quote(args) }}

ios *args:
    node scripts/ios.ts {{ quote(args) }}

mobile-e2e platform="android" scenario="":
    node scripts/mobile-e2e.ts {{ platform }} {{ scenario }}

mobile-e2e-check:
    node scripts/mobile-e2e.ts --check

web-lock:
    node scripts/web-production-lock.ts --write

web-lock-check:
    node scripts/web-production-lock.ts --check

mobile-e2e-agent-device platform="android" scenario="":
    MOBILE_E2E_RUNNER=agent-device node scripts/mobile-e2e.ts {{ platform }} {{ scenario }}

mobile-e2e-argent platform="android" scenario="":
    MOBILE_E2E_RUNNER=argent node scripts/mobile-e2e.ts {{ platform }} {{ scenario }}

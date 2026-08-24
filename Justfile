set unstable
set lists

[parallel]
qa-tasks: lint mobile-e2e-check test

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

# Two invocations, not `vp run -r test`: with the whole workspace selected at once, Vite+ drops
# @stu/web from the task graph whenever the packages it depends on are in the same selection, so
# `-r` silently ran five of six packages and never the web app's tests.
test:
    vp run --filter "./packages/*" test
    vp run --filter "./apps/*" test

db-generate:
    vp run --filter "@stu/server" db:generate

db-migrate:
    vp run --filter "@stu/server" db:migrate

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
    vp run --filter "./apps/console" dev {{ quote(args) }}

ios *args:
    node scripts/ios.ts {{ quote(args) }}

mobile-e2e platform="android" scenario="":
    node scripts/mobile-e2e.ts {{ platform }} {{ scenario }}

mobile-e2e-check:
    node scripts/mobile-e2e.ts --check

mobile-e2e-agent-device platform="android" scenario="":
    MOBILE_E2E_RUNNER=agent-device node scripts/mobile-e2e.ts {{ platform }} {{ scenario }}

mobile-e2e-argent platform="android" scenario="":
    MOBILE_E2E_RUNNER=argent node scripts/mobile-e2e.ts {{ platform }} {{ scenario }}

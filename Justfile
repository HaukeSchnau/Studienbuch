set unstable
set lists

[parallel]
qa-tasks: lint test

qa: fmt qa-tasks
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

test:
    vp run -r test

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

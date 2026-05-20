[parallel]
qa-tasks: lint test

qa: fmt qa-tasks
fix: fmt lint-fix

fmt:
    bun run oxfmt

fmt-check:
    bun run oxfmt --check

lint:
    bun run oxlint --disable-nested-config --report-unused-disable-directives

lint-fix:
    bun run oxlint --disable-nested-config --report-unused-disable-directives --fix

test:
    bun run test

icons:
    bun run generate:icons

clean:
    rm -rf dist node_modules apps/*/node_modules packages/*/node_modules apps/*/dist packages/*/dist apps/mobile/ios app/mobile/.expo
    bun i

dev app options="":
    bun run --cwd apps/{{app}} dev {{options}}

build app:
    bun run --cwd apps/{{app}} build

start app:
    bun run --cwd apps/{{app}} start

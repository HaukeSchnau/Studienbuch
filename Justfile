[parallel]
check: fmt-check lint

fix: fmt lint-fix

qa: check test

fmt:
    bun run oxfmt

fmt-check:
    bun run oxfmt --check

lint:
    bun run oxlint --report-unused-disable-directives

lint-fix:
    bun run oxlint --report-unused-disable-directives --fix

test:
    bun run test

clean:
    rm -rf dist node_modules apps/*/node_modules packages/*/node_modules apps/*/dist packages/*/dist 

dev app options:
    bun run --cwd apps/{{app}} dev {{options}}

build app:
    bun run --cwd apps/{{app}} build

start app:
    bun run --cwd apps/{{app}} start

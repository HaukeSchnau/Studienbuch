[parallel]
check: fmt-check lint

fix: fmt lint-fix

fmt:
    bun run oxfmt

fmt-check:
    bun run oxfmt --check

lint:
    bun run oxlint --report-unused-disable-directives

lint-fix:
    bun run oxlint --report-unused-disable-directives --fix

clean:
    rm -rf dist node_modules apps/*/node_modules packages/*/node_modules apps/*/dist packages/*/dist 

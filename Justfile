fmt:
    bun run oxfmt

lint:
    bun run oxlint --report-unused-disable-directives

clean:
    rm -rf dist node_modules apps/*/node_modules packages/*/node_modules apps/*/dist packages/*/dist .turbo apps/*/.turbo packages/*/.turbo

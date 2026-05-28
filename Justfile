[parallel]
qa-tasks: lint test

ios_device := "539D7C55-85D6-50B1-BE9B-88293D4628C3"

qa: fmt qa-tasks
fix: fmt lint-fix

doctor-mobile:
    bun run --cwd apps/mobile doctor
    bun run --cwd apps/mobile doctor:deps
    nix shell nixpkgs#nodejs_24 -c npm exec --prefix apps/mobile react-compiler-healthcheck@latest -- .

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
    rm -rf dist node_modules apps/*/node_modules packages/*/node_modules apps/*/dist packages/*/dist apps/mobile/ios apps/mobile/android app/mobile/.expo
    bun i

dev app options="":
    bun run --cwd apps/{{app}} dev {{options}}

build app:
    bun run --cwd apps/{{app}} build

start app:
    bun run --cwd apps/{{app}} start

_ios-local-build profile:
    tmpbin="$$(mktemp -d)"; \
    trap 'rm -rf "$$tmpbin"' EXIT; \
    printf '#!/bin/sh\nexec /usr/bin/sed "$$@"\n' > "$$tmpbin/sed"; \
    printf '#!/bin/sh\nexec /usr/bin/rsync "$$@"\n' > "$$tmpbin/rsync"; \
    chmod +x "$$tmpbin/sed" "$$tmpbin/rsync"; \
    env PATH="$$tmpbin:$$PATH" NODE_OPTIONS=--dns-result-order=ipv4first EXPO_USE_PRECOMPILED_MODULES=0 EAS_LOCAL_BUILD_SKIP_CLEANUP=1 bunx eas build --platform ios --profile {{profile}} --local --non-interactive

ios-install-dev:
    just _ios-local-build development
    latest_ipa="$$(ls -t apps/mobile/build-*.ipa | head -n 1)"; \
    xcrun devicectl device install app --device {{ios_device}} "$$latest_ipa"

ios-install-prod:
    just _ios-local-build preview
    latest_ipa="$$(ls -t apps/mobile/build-*.ipa | head -n 1)"; \
    xcrun devicectl device install app --device {{ios_device}} "$$latest_ipa"

ios-install-both:
    dev_marker="$$(mktemp)"; \
    prod_marker="$$(mktemp)"; \
    touch "$$dev_marker" "$$prod_marker"; \
    (just _ios-local-build development && find apps/mobile -maxdepth 1 -name 'build-*.ipa' -newer "$$dev_marker" -print | sort | tail -n 1 > "$$dev_marker.path") & \
    dev_pid="$$!"; \
    (just _ios-local-build preview && find apps/mobile -maxdepth 1 -name 'build-*.ipa' -newer "$$prod_marker" -print | sort | tail -n 1 > "$$prod_marker.path") & \
    prod_pid="$$!"; \
    wait "$$dev_pid"; \
    wait "$$prod_pid"; \
    dev_ipa="$$(cat "$$dev_marker.path")"; \
    prod_ipa="$$(cat "$$prod_marker.path")"; \
    xcrun devicectl device install app --device {{ios_device}} "$$dev_ipa"; \
    xcrun devicectl device install app --device {{ios_device}} "$$prod_ipa"; \
    rm -f "$$dev_marker" "$$prod_marker" "$$dev_marker.path" "$$prod_marker.path"

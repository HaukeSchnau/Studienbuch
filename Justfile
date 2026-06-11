[parallel]
qa-tasks: lint test check-mobile-boundaries

ios_device := env_var_or_default("IOS_DEVICE", "539D7C55-85D6-50B1-BE9B-88293D4628C3")
ios_artifacts_dir := env_var_or_default("IOS_ARTIFACTS_DIR", "/tmp/studienbuch-mobile-builds")
ios_dev_ipa := ios_artifacts_dir + "/studienbuch-dev.ipa"
ios_prod_ipa := ios_artifacts_dir + "/studienbuch-prod.ipa"

qa: fmt qa-tasks
fix: fmt lint-fix

doctor-mobile:
    nix shell nixpkgs#cocoapods -c bun run --cwd apps/mobile doctor
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

check-mobile-boundaries:
    bun scripts/check-mobile-boundaries.ts

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

_ios-local-build profile output:
    mkdir -p "$(dirname "{{output}}")"
    rm -f "{{output}}"
    tmpbin="$(mktemp -d)"; \
    trap 'rm -rf "$tmpbin"' EXIT; \
    printf '#!/bin/sh\nexec /usr/bin/sed "$@"\n' > "$tmpbin/sed"; \
    printf '#!/bin/sh\nexec /usr/bin/rsync "$@"\n' > "$tmpbin/rsync"; \
    printf '#!/bin/sh\nif [ "$1" = "--no-pager" ] && [ "$2" = "log" ] && [ "$3" = "-1" ] && [ "$4" = "--pretty=%%B" ]; then\n  output="$(/usr/bin/git "$@")"\n  status="$?"\n  if [ "$status" -ne 0 ]; then\n    exit "$status"\n  fi\n  if [ -n "$output" ]; then\n    printf "%%s" "$output"\n  else\n    printf "%%s\\n" "Local {{profile}} build"\n  fi\nelse\n  exec /usr/bin/git "$@"\nfi\n' > "$tmpbin/git"; \
    chmod +x "$tmpbin/sed" "$tmpbin/rsync" "$tmpbin/git"; \
    cd apps/mobile && nix shell nixpkgs#fastlane nixpkgs#cocoapods -c sh -c 'PATH="$1:$PATH" NODE_OPTIONS=--dns-result-order=ipv4first EXPO_USE_PRECOMPILED_MODULES=0 EAS_LOCAL_BUILD_SKIP_CLEANUP=1 bunx eas-cli build --platform ios --profile "$2" --local --non-interactive --message "Local $2 build" --output "$3"' sh "$tmpbin" "{{profile}}" "{{output}}"
    test -s "{{output}}"

ios-devices:
    xcrun devicectl list devices

ios-build-dev:
    just _ios-local-build development "{{ios_dev_ipa}}"

ios-build-prod:
    just _ios-local-build production-device "{{ios_prod_ipa}}"

ios-build-both: ios-build-dev ios-build-prod

ios-install-ipa ipa:
    xcrun devicectl device install app --device {{ios_device}} "{{ipa}}"

ios-install-dev: ios-build-dev
    just ios-install-ipa "{{ios_dev_ipa}}"

ios-install-prod: ios-build-prod
    just ios-install-ipa "{{ios_prod_ipa}}"

ios-install-both: ios-build-both
    just ios-install-ipa "{{ios_dev_ipa}}"
    just ios-install-ipa "{{ios_prod_ipa}}"
    just ios-installed-apps

ios-installed-apps:
    xcrun devicectl device info apps --device {{ios_device}} | rg 'dev\.schnau\.studienbuch'

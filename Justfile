[parallel]
qa-tasks: lint test

qa: fmt qa-tasks
fix: fmt lint-fix

doctor:
    react-doctor

doctor-mobile:
    cd apps/mobile && nix shell nixpkgs#cocoapods -c vp dlx expo-doctor
    cd apps/mobile && vp exec expo install --check
    nix shell nixpkgs#nodejs_24 -c vp dlx react-compiler-healthcheck@latest apps/mobile

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
    rm -rf dist node_modules .vite-plus apps/*/node_modules apps/*/.vite-plus packages/*/node_modules packages/*/.vite-plus scripts/node_modules apps/*/dist packages/*/dist apps/mobile/ios apps/mobile/android apps/mobile/.expo
    just install

dev app options="":
    vp run --filter "./apps/{{app}}" dev -- {{options}}

build app:
    vp run --filter "./apps/{{app}}" build

start app:
    vp run --filter "./apps/{{app}}" start

web-dev-server:
    cd apps/web && vp dev

web-preview:
    cd apps/web && vp preview

storybook:
    cd apps/web && vp exec storybook dev -p 6006

storybook-build:
    cd apps/web && vp exec storybook build

mobile-dev-client:
    cd apps/mobile && vp exec expo run:ios

mobile-update-preview:
    cd apps/mobile && vp dlx eas-cli update --channel preview

mobile-update-production:
    cd apps/mobile && vp dlx eas-cli update --channel production

mobile-update-rollout percentage="10":
    cd apps/mobile && vp dlx eas-cli update --channel production --rollout-percentage "{{percentage}}"

mobile-update-rollback:
    cd apps/mobile && vp dlx eas-cli update:rollback --channel production

mobile-update-assets platform="":
    PLATFORM="{{platform}}" node apps/mobile/scripts/verify-update-assets.mjs

mobile-update-fingerprints:
    cd apps/mobile && vp exec expo-updates fingerprint:generate --platform ios
    cd apps/mobile && vp exec expo-updates fingerprint:generate --platform android

mobile-observe-versions:
    cd apps/mobile && vp dlx eas-cli observe:versions

mobile-observe-metrics:
    cd apps/mobile && vp dlx eas-cli observe:metrics-summary

ios-build profile output:
    node scripts/ios.ts build "{{profile}}" "{{output}}"

ios-devices:
    node scripts/ios.ts devices

ios-build-dev:
    node scripts/ios.ts build-dev

ios-build-prod:
    node scripts/ios.ts build-prod

ios-build-both:
    node scripts/ios.ts build-both

ios-install-ipa ipa:
    node scripts/ios.ts install "{{ipa}}"

ios-install-dev:
    node scripts/ios.ts install-dev

ios-install-prod:
    node scripts/ios.ts install-prod

ios-install-both:
    node scripts/ios.ts install-both

ios-installed-apps:
    node scripts/ios.ts installed-apps

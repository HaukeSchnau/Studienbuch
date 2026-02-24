# Workspace Package Catalog

## Product and Runtime Packages (`packages/*`)

- `@stu/api` (`packages/api`): standalone backend runtime and sync/snapshot transport.
- `@stu/app-mobile` (`packages/app-mobile`): Expo mobile app with local-first sync runtime.
- `@stu/nextjs` (`packages/nextjs`): Next.js web/admin surface.
- `@stu/admin-panel` (`packages/admin-panel`): TanStack Start admin panel.
- `@stu/console` (`packages/console`): operational CLI/background command surface.

## Domain and Data Packages

- `@stu/lib` (`packages/lib`): shared domain contracts, events, repository logic, snapshot contracts.
- `@stu/db` (`packages/db`): server-side Postgres schema/repositories/applicators.
- `@stu/student` (`packages/student`): SQLite student-side schema/repositories/applicators.
- `@stu/lib-server` (`packages/lib-server`): server utility layer (auth/session/notifications/schedule/pdf).
- `@stu/external-api` (`packages/external-api`): integrations for Untis, holidays, Linear, HTTP resilience.
- `@stu/legacy-import` (`packages/legacy-import`): legacy database import/migration helpers.

## Native and UI Support

- `@stu/expo-native` (`packages/expo-native`): custom Expo native modules.
- `@stu/expo-native-example` (`packages/expo-native-example`): Storybook/Expo example app for native modules.

## Tooling Workspace Packages (`tooling/*`)

- `@stu/tailwind-config` (`tooling/tailwind`): shared Tailwind presets for web/native.
- `@stu/testing` (`tooling/testing`): shared Vitest setup and mocks.
- `@stu/tsconfig` (`tooling/typescript`): shared TypeScript config presets.

## Per-Package Documentation

Each package has a local README:

- `packages/*/README.md`
- `tooling/*/README.md`

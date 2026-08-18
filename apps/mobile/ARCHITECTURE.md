# Mobile Architecture

This package should stay feature-oriented, local-first, and easy to reshape while the product is
young. Prefer clear ownership over clever abstractions. A folder should exist because it answers
"what owns this code?", not because another app template had the same folder.

## Source Layout

```txt
src/
  app/          Expo Router route adapters only
  app-shell/    app boot, providers, setup gates, and route-aware shell components
  compat/       temporary legacy mobile DTOs and policies
  data/         mobile data facade and implementations
  domain-ui/    reusable school-domain presentation components
  features/     product features and feature-local model/view code
  components/   generic UI, fields, feedback, and layout primitives
  platform/     wrappers around native/device APIs
  routing/      typed route params and path builders
  theme/        design tokens
  assets/       app-wide assets
```

## Ownership Rules

- `packages/core` owns domain types, policies, selectors, and formatters. It must stay platform
  agnostic: no React, React Native, Expo, app routes, storage, or network code.
- `src/compat` owns the mobile app's temporary legacy DTO contract and policies. New code should use
  the domain modules in `packages/core`; remove compatibility code as its consumers migrate.
- `src/app` owns filesystem routes. Route files parse params, configure route-level navigation, and
  render feature screens. They should stay thin.
- `src/app-shell` owns app bootstrapping and route-aware shell pieces: providers, splash/font
  loading, setup gates, and screen scaffolds that configure Expo Router.
- `src/data` is the only app-facing data boundary. Features import data through public hooks such as
  `useCourses`, `useTasks`, or `useSession`. The current implementation is fixture-backed and lives
  under `src/data/mock`; future persistence and sync should replace the implementation behind the
  same facade.
- `src/features` owns product workflows. Feature `model` files must be pure TypeScript and are the
  preferred home for non-trivial view-model logic. Feature screens may compose generic components,
  domain-ui components, data hooks, and public barrels from other features.
- `src/components` is generic UI only. Code here must not import data hooks, feature code, or
  school-domain types unless the component is moved to `domain-ui`.
- `src/domain-ui` owns reusable presentation components that know about school concepts such as
  subjects, courses, signatures, and confirmation state. These components should not fetch app data.
- `src/platform` owns native/device wrappers such as haptics. Features should depend on these small
  wrappers instead of importing native modules directly.
- `src/routing` owns route parameter parsing and route path construction. Avoid scattering route
  string templates through feature components.

## Import Direction

The intended dependency flow is:

```txt
app -> app-shell -> features -> data -> packages/core
                  -> domain-ui -> components/theme/assets
                  -> platform/routing
```

Cross-feature imports are allowed only through public feature barrels. If a feature needs another
feature's private component, either promote that component to the imported feature's public API or
move it to `domain-ui`.

## Refactor Checklist

Before adding new mobile code:

1. Put pure domain rules in `packages/core`.
2. Put app data access behind `src/data`.
3. Put screen-specific UI inside its feature.
4. Put reusable domain presentation in `src/domain-ui`.
5. Put reusable generic primitives in `src/components`.
6. Add or update tests for extracted model logic.
7. Run `just qa`.

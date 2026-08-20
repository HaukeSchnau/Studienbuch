# Mobile Architecture

This package should stay feature-oriented, local-first, and easy to reshape while the product is
young. Prefer clear ownership over clever abstractions. A folder should exist because it answers
"what owns this code?", not because another app template had the same folder.

## Source Layout

```txt
src/
  app/          Expo Router route adapters only
  features/     product features, including their own shell pieces and widgets
  domain-ui/    reusable school-domain presentation components
  ui/           generic UI, fields, feedback, layout, navigation chrome, tokens
  infra/        exists because of a technology choice, not the problem
    data/         data facade and its current fixture implementation
    native/       wrappers around native/device APIs
    observability/  telemetry ports and the Sentry adapter
    routing/      typed route params and path builders
    session/      session state
    widgets/      the Expo SwiftUI binding
    providers.tsx app-wide provider composition
  compat/       temporary legacy mobile DTOs and policies
  assets/       app-wide assets
```

`app-shell/` used to hold providers, navigation chrome, session, the setup gate and a widget
publisher under one name. Those are five different reasons to exist, so each moved to the directory
that explains it. `setup-gate-policy.ts` in particular is domain logic with its own test and now
lives in `features/setup` beside the rest of setup.

## Ownership Rules

- `packages/core` owns domain types, policies, selectors, and formatters. It must stay platform
  agnostic: no React, React Native, Expo, app routes, storage, or network code.
- `src/compat` owns the mobile app's temporary legacy DTO contract and policies. New code should use
  the domain modules in `packages/core`; remove compatibility code as its consumers migrate.
- `src/app` owns filesystem routes. Route files parse params, configure route-level navigation, and
  render feature screens. They should stay thin.
- `src/infra` owns everything that exists because of a technology choice rather than the problem:
  providers, native wrappers, telemetry, routing helpers, session, and the data boundary. Swap a
  technology and this is the directory that changes.
- `src/infra/data` is the only app-facing data boundary. Features import data through public hooks
  such as `useCourses`, `useTasks`, or `useSession`. The current implementation is fixture-backed
  and lives under `src/infra/data/mock`; future persistence and sync should replace the
  implementation behind the same facade.
- `src/features` owns product workflows. Feature `model` files must be pure TypeScript and are the
  preferred home for non-trivial view-model logic. Feature screens may compose generic components,
  domain-ui components, data hooks, and public barrels from other features.
- `src/ui` is generic UI only, including navigation chrome and design tokens. Code here must not
  import data hooks, feature code, or school-domain types; if it needs them, it belongs in
  `domain-ui`.
- `src/domain-ui` owns reusable presentation components that know about school concepts such as
  subjects, courses, signatures, and confirmation state. These components should not fetch app data.
- `src/infra/native` owns native/device wrappers such as haptics. Features should depend on these
  small wrappers instead of importing native modules directly.
- `src/infra/routing` owns route parameter parsing and route path construction. Avoid scattering
  route string templates through feature components.

## Import Direction

The intended dependency flow is:

```txt
app -> features -> infra/data -> packages/core
                -> domain-ui -> ui/assets
                -> infra/*
```

Cross-feature imports are allowed only through public feature barrels. If a feature needs another
feature's private component, either promote that component to the imported feature's public API or
move it to `domain-ui`.

## Refactor Checklist

Before adding new mobile code:

1. Put pure domain rules in `packages/core`.
2. Put app data access behind `src/infra/data`.
3. Put screen-specific UI inside its feature.
4. Put reusable domain presentation in `src/domain-ui`.
5. Put reusable generic primitives in `src/ui`.
6. Add or update tests for extracted model logic.
7. Run `just qa`.

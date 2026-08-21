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
    effect-atom/  registry and provider wiring
    data/         temporary fixture context for domains not yet using atoms
    mock-data/    fixture-backed implementations and seed data
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
  providers, native wrappers, telemetry, routing helpers, persistence adapters, and sync
  transports. Swap a technology and this is the directory that changes.
- Each feature owns its atoms, queries, commands, and React hooks. For example, task state belongs
  to `src/features/tasks` even though its implementation uses Effect Atom. The task problem owns
  the state; Effect Atom is how the app makes it reactive.
- `src/infra/effect-atom` owns only the shared registry and provider wiring. Mock fixtures seed that
  registry while the app has no persistent data source.
- `src/infra/mock-data` owns the current fixture-backed implementation. Features must not import it;
  providers and future Effect Layers adapt it to feature-owned state.
- `src/infra/data` is temporary. It still holds the React context for domains that have not moved
  to feature-owned atoms. Delete it after the migration inventory below reaches zero.
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
app -> features -> packages/core
                -> domain-ui -> ui/assets
                -> infra adapters
app providers -> infra/effect-atom -> feature atoms
```

Cross-feature imports are allowed only through public feature barrels. If a feature needs another
feature's private component, either promote that component to the imported feature's public API or
move it to `domain-ui`.

## Data and state migration

The feature hook is the UI boundary. Components should not know whether its values come from mock
fixtures, SQLite, or synchronization. During the mock phase, writable atoms apply commands directly
to registry-owned state. A later persistence adapter can replace those atom implementations with
Effect-backed queries and commands without changing component imports.

| Domain         | Owner                                           | Current source                       |
| -------------- | ----------------------------------------------- | ------------------------------------ |
| Tasks          | `features/tasks`                                | Effect Atom, seeded by mock fixtures |
| Courses        | `features/courses`                              | Temporary fixture context            |
| Grades         | `features/courses/grades`                       | Temporary fixture context            |
| Schedule       | `features/schedule`                             | Temporary fixture context            |
| Absences       | `features/absences`                             | Temporary fixture context            |
| Profile        | `features/profile`                              | Temporary fixture context            |
| Setup progress | `features/setup`                                | Temporary fixture context            |
| School catalog | organization feature, to be named when migrated | Temporary fixture context            |

Migrate one complete domain at a time. Move its read state, commands, hooks, and consumers together,
then remove that domain from the fixture context. Do not create a replacement central data facade.

TODO: Effect Atom rc.108 declares React 19.2.7 as its minimum peer, while Expo 57 pins React 19.2.3.
The rc.108 React bindings only call APIs available in 19.2.3, and the focused task tests pass, but
the combination remains outside the package's declared range. Recheck this constraint when either
Expo or Effect Atom changes. Do not upgrade React independently of Expo to silence the warning.

## Refactor Checklist

Before adding new mobile code:

1. Put pure domain rules in `packages/core`.
2. Put reactive state, queries, commands, and hooks in the feature that owns them.
3. Put persistence, sync, and device implementations in `src/infra`.
4. Put screen-specific UI inside its feature.
5. Put reusable domain presentation in `src/domain-ui`.
6. Put reusable generic primitives in `src/ui`.
7. Add or update focused tests for state transitions and extracted model logic.
8. Run `just qa`.

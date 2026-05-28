# Mobile Modernization Roadmap

Last researched: 2026-05-28

## Scope

This roadmap answers: "What should we modernize in `apps/mobile` now that the app is on Expo SDK 56 and React Native 0.85, while intentionally deferring the real data layer and business logic?"

Assumptions:

- The current priority is a stronger UI shell, more native platform behavior, and less custom plumbing.
- Local-first data architecture, sync, repositories, and domain wiring are explicitly out of scope for this pass.
- The app should continue to target iOS and Android first, with web remaining a secondary runtime.

## Current Audit

### What Is Already In Good Shape

- The app is already on Expo SDK 56 and React Native 0.85.
- Expo Router is a good long-term fit for the current route structure.
- `react-native-reanimated`, `react-native-gesture-handler`, and `react-native-screens` are already present and current for this SDK generation.
- The React Compiler is viable in this repo: the official healthcheck successfully compiled all current components when run under Node 24.

### What Is Carrying Old UI Debt

- A custom sheet and portal system lives in:
  - `apps/mobile/src/components/bottom-sheet.tsx`
  - `apps/mobile/src/components/portal.tsx`
  - `apps/mobile/src/app/_layout.tsx`
- Community form controls still back key flows:
  - `apps/mobile/src/components/date-field.tsx`
  - `apps/mobile/src/components/select-field.tsx`
  - `apps/mobile/src/features/profile/semester-selector.tsx`
- Shared visual primitives are still partly hand-rolled per screen instead of forming a small stable design system.
- The project runtime story is slightly inconsistent:
  - `package.json` expects Node 24
  - local shell access in this environment defaults to Node 26
  - `react-compiler-healthcheck` fails under Node 26 even though the app itself checks out under Node 24

### Healthcheck Results From This Audit

- `expo-doctor`: exposed one actionable dependency mismatch, `expo@~56.0.5` vs expected `~56.0.6`
- `expo install --check`: confirmed the same Expo patch drift
- `react-compiler-healthcheck`: passes when run with `nodejs_24`
- After bumping Expo to `~56.0.6`, the remaining `expo-doctor` failures are:
  - duplicate `expo-constants` copies in `node_modules`
  - missing or outdated CocoaPods tooling in the local environment

## Principles For This Refactor

1. Replace custom mobile plumbing only when Expo SDK 56 gives us an established native-backed path.
2. Hide ecosystem churn behind app-owned primitives and adapters.
3. Prefer native-feeling defaults over screen-by-screen styling tricks.
4. Keep the migration incremental so each step can be verified with `just qa` and a quick device smoke test.

## Recommended Order

### Phase 1: Foundation

Goal: make the current stack reproducible and easier to validate.

Changes:

- Keep Expo on the expected SDK 56 patch line.
- Add a repeatable mobile doctor workflow:
  - `expo-doctor`
  - `expo install --check`
  - `react-compiler-healthcheck` under Node 24
- Treat Node 24 as the canonical runtime for mobile tooling until the compiler healthcheck is happy on newer Node versions.

Files:

- `apps/mobile/package.json`
- `Justfile`

Exit criteria:

- mobile doctor commands are easy to rerun
- Expo patch drift stays fixed
- compiler healthcheck remains green under the intended runtime

### Phase 2: Control Modernization

Goal: replace older community controls with Expo UI drop-ins that render through SwiftUI and Jetpack Compose.

Status: completed on 2026-05-28 for the first control pass.

Packages to remove over this phase:

- `@react-native-community/datetimepicker`
- `@react-native-picker/picker`
- `@react-native-segmented-control/segmented-control`

Packages to keep and lean on:

- `@expo/ui`
- `expo-symbols`

Files to migrate:

- `apps/mobile/src/components/date-field.tsx`
- `apps/mobile/src/components/select-field.tsx`
- `apps/mobile/src/features/profile/semester-selector.tsx`
- `apps/mobile/app.config.ts` once `@react-native-community/datetimepicker` is removed from plugins

Notes:

- This should be a mostly import-level migration with small prop adjustments.
- The main win is not visual novelty; it is better native behavior and less third-party maintenance overhead.
- Completed in:
  - `apps/mobile/src/components/date-field.tsx`
  - `apps/mobile/src/components/select-field.tsx`
  - `apps/mobile/src/features/profile/semester-selector.tsx`
  - `apps/mobile/app.config.ts`
  - `apps/mobile/package.json`

### Phase 3: Sheet And Overlay Modernization

Goal: retire the custom portaled bottom sheet stack in favor of Expo UI's native-backed sheet path.

Files to replace or remove:

- `apps/mobile/src/components/bottom-sheet.tsx`
- `apps/mobile/src/components/portal.tsx`
- `apps/mobile/src/app/_layout.tsx`

Primary call sites:

- `apps/mobile/src/features/profile/profile-header.tsx`
- `apps/mobile/src/features/tasks/tasks.tsx`
- `apps/mobile/src/features/absences/absences-overview-card.tsx`
- `apps/mobile/src/features/courses/grades/master-grade-row.tsx`
- `apps/mobile/src/features/courses/grades/oral-grades-row.tsx`
- `apps/mobile/src/features/courses/grades/written-grades-row.tsx`

Notes:

- This is the highest-value native-feel cleanup in the current codebase.
- Do the migration behind one app-owned wrapper so future sheet API churn stays localized.

### Phase 4: Shared Primitive Cleanup

Goal: stop letting screen-level styling become the de facto design system.

Focus areas:

- buttons
- cards
- text inputs
- field wrappers and labels
- section headers
- chip or pill treatments
- sheet content scaffolding

Candidate files:

- `apps/mobile/src/components/button.tsx`
- `apps/mobile/src/components/card.tsx`
- `apps/mobile/src/components/text.tsx`
- `apps/mobile/src/components/field-label.tsx`
- `apps/mobile/src/components/styles/shadow.ts`

Notes:

- This phase should shrink repeated spacing and styling decisions across feature screens.
- NativeWind should remain a tool, not the architecture.

### Phase 5: Interaction And Performance

Goal: make the UI feel more native and resilient before any real data arrives.

Focus areas:

- standardize on `GestureDetector` and `Gesture.*`
- use Reanimated for state transitions that should stay on the UI thread
- adopt `ReanimatedSwipeable` when row actions appear
- evaluate `FlashList` for heavier scroll surfaces

Likely screens to inspect first:

- `apps/mobile/src/features/schedule/schedule.page.tsx`
- `apps/mobile/src/features/profile/profile.page.tsx`
- `apps/mobile/src/features/tasks/tasks.tsx`

Notes:

- This is where we should tune re-renders, scroll smoothness, and list ergonomics.
- Only introduce `FlashList` where list size or heterogeneous rows justify it.

## Explicitly Deferred

These are intentionally not part of this roadmap slice:

- SQLite, Drizzle, repository design, sync strategy, and other local-first data decisions
- TanStack Query integration
- Secure storage and token architecture, except where a future UI-only preference needs it
- Domain model changes in `packages/core`

## Next Slice

The next implementation slice should be:

1. replace the custom portaled sheet stack with an Expo UI-backed wrapper
2. remove `apps/mobile/src/components/portal.tsx` once sheets no longer depend on it
3. simplify `apps/mobile/src/app/_layout.tsx` after portal removal
4. run `just qa`
5. smoke test the affected flows on iOS and Android

## Sources

- [Expo SDK 56 changelog](https://expo.dev/changelog/sdk-56?q=expo)
- [Expo React Compiler guide](https://docs.expo.dev/guides/react-compiler/)
- [Expo UI drop-in replacements overview](https://docs.expo.dev/versions/v55.0.0/sdk/ui/drop-in-replacements/)
- [Expo UI BottomSheet](https://docs.expo.dev/versions/v56.0.0/sdk/ui/drop-in-replacements/bottomsheet/)
- [Expo UI Picker](https://docs.expo.dev/versions/v56.0.0/sdk/ui/drop-in-replacements/picker)
- [Expo UI SegmentedControl](https://docs.expo.dev/versions/v55.0.0/sdk/ui/drop-in-replacements/segmentedcontrol/)
- [Expo UI DateTimePicker](https://docs.expo.dev/versions/latest/sdk/ui/drop-in-replacements/datetimepicker/)
- [React Native shadow props](https://reactnative.dev/docs/shadow-props)

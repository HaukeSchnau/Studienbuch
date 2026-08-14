# Legacy mobile behavior archaeology

This directory preserves what the legacy Studienbuch apps teach us without silently turning every
old implementation detail into a requirement. The production Flutter app is the primary behavioral
and visual reference. The archived React Native app corroborates behavior, fills gaps, and exposes
deliberate experiments; it does not overrule Flutter by itself.

- [catalogue.md](catalogue.md) indexes accepted behavior and its executable-specification backlog.
- [open-decisions.md](open-decisions.md) quarantines legacy bugs, ambiguity, and product questions.

## Evidence roots

Scenario and catalogue references use portable prefixes instead of Hauke's absolute filesystem
paths:

- `flutter:` marks production Flutter evidence; the following path is relative to
  `studienbuch-archive/` and normally begins `Stubu-legacy-flutter/apps/flutter/`.
- `react-native:` marks archived React Native evidence; the following path is relative to
  `studienbuch-archive/` and normally begins `Studienbuch-Legacy/`.
- `current:` resolves beneath this repository root.

Catalogue tables may shorten Flutter paths to `lib/` and React Native paths to `src/`; those resolve
beneath the respective app roots above. Scenario contracts retain archive-relative paths so each
piece of executable specification is self-contained.

The archive normally lives at `/home/haukeschnau/context/studienbuch-archive`. Line references are
evidence pointers, not imports or runtime dependencies.

## Authority and disposition

Use this order when evidence conflicts:

1. A current product decision by Hauke.
2. Observable production Flutter behavior.
3. Flutter source, tests, assets, and persisted data model.
4. Legacy React Native behavior and source.
5. Other archived backend, release, and experiment material.
6. Explicitly labelled inference.

Every catalogue entry has one disposition:

- **Accepted** — part of the rewrite's product contract and covered by one or more scenarios.
- **Needs decision** — plausible behavior with ambiguity, disagreement, or questionable value.
- **Rejected** — deliberately excluded, with the reason retained.

Confidence is separate from disposition:

- **Established** — directly visible or enforced by the primary Flutter implementation.
- **Corroborated** — independently present in both mobile implementations.
- **Inferred** — suggested by source but not yet demonstrated in a running legacy build.
- **Questionable** — likely accidental, obsolete, incomplete, or harmful.

Only accepted behavior belongs in `apps/mobile/e2e/scenarios/`. Unresolved observations remain in
the catalogue so a future implementation cannot accidentally settle the product question.

## Readable executable specification

Scenario contracts follow `apps/mobile/e2e/SCENARIO_TEMPLATE.md` and use four principles:

1. The rule states the product guarantee in domain language.
2. The Given/When/Then example describes intent rather than widget mechanics.
3. Every outcome maps to stable, user-observable executable evidence.
4. Initial state, final state, and side effects make isolation and persistence explicit.

The Markdown contract is the source of truth. An agent-device script and an Argent YAML flow are
paired executable adapters. They may be created only through live recording once the rewrite can
reach the contract's named state, and each unchanged recording must pass twice.

## Archaeology workflow

1. Inventory routes, screens, controls, domain operations, and persisted state.
2. Trace happy paths and then their validation, empty, error, offline, restart, and reconnect edges.
3. Record exact evidence and distinguish observation from inference.
4. Compare Flutter and React Native behavior and preserve disagreements.
5. Assign a disposition. Escalate choices that materially change the product.
6. Map every accepted entry to one or more runner-neutral scenario contracts.
7. During the rewrite, implement deterministic fixtures and semantic accessibility identifiers.
8. Record both runners live and preserve their two-pass comparison evidence.

## Naming

Use an outcome-oriented semantic slug such as `tasks-create-with-photo` or
`sync-replay-after-relaunch`. Avoid sequence numbers, `happy-path`, `works`, and screen-only names.
Use consistent domain terms; quote exact German UI copy only when the copy itself is evidence.

# Studienbuch

Studienbuch is a school planner for students: the timetable and substitutions imported from WebUntis, homework, grades, absences and the signatures they need. Teachers and parents join later. It is local first: every device keeps its data in SQLite and syncs when it can. One Expo app runs on iOS, Android and the web, a TanStack Start site carries the landing page, legal pages and the operator console, and one Effect server process serves both and runs sync.

The repository is in a from-scratch rewrite (milestone M0 started 2026-10-28). The old tree is at the `legacy-2026-10` bookmark. Nothing comes back from it without review ([ADR 0002](docs/adr/0002-restart-in-place.md)).

## What Studienbuch never compromises on

### 1. It works offline

Screens read local SQLite and never wait for the network. A write lands in the local database and the outbox in one transaction and shows at once. The server confirms or refuses it later, and a refusal stays on screen with its reason. A phone in flight mode for a week is a normal state, not an error path.

### 2. Students' privacy

Most users are minors. Grades, absences, homework, signatures, photos and the display name are end-to-end encrypted: they leave the device as an envelope plus ciphertext, and the server enforces membership, roles, key epochs and signatures without reading them. School data stays readable, because the server imports it. Our privacy claim names what the server still sees: email, course choices, who is in which space, activity times, padded sizes and school data.

### 3. Three platforms

iOS, Android and the web are one Expo app. A feature works on all three, or the PR says why not. The landing page renders real app components with demo data.

### 4. Long-term maintainability

Before adding functionality, check whether shared logic belongs in its own module. Duplicate logic across files is a defect. Change existing code instead of adding a local workaround next to it.

## A note from Hauke

I like ambitious ideas, simple systems, and software that feels obvious. Do not preserve complexity just because it already exists. Do not introduce machinery because it looks architecturally impressive. Understand the real constraint, then fight for the smallest model that makes the correct behavior unsurprising.

Channel both "measure twice, cut once" and "yagni". Fight scope creep. Try to honor the dev's intent in both a minimal and realistic fashion.

The rest of this document is meant to help you navigate the codebase and make changes effectively. Think of these instructions less as "hard rules", more as "good defaults". The developer's preferences should be able to override anything here.

## Glossary

People:

- **you**: the agent reading this file.
- **Hauke**: the owner. He judges work on PR previews and beta, not by reading code.
- **the orchestrator**: the agent that plans work packages, assigns file ownership and merges PRs.
- **student, teacher, parent**: the product's users. v1 serves students.
- **operator**: someone running Studienbuch itself, through the console.

Places:

- **dev instance**: `devenv up` in one worktree, on localhost.
- **preview**: a PR's release build at `pr-<n>.studienbuch.schnau.dev` (Tailnet), with its own database and the demo school.
- **beta**: `beta.studienbuch.app`, deployed from every green push to `main`, importing live from WebUntis. TestFlight and Play internal builds point at it.
- **device**: one installation's local database. In a browser, `?device=a` and `?device=b` are two virtual devices, each with its own storage.

The domain. UI copy is German, code is English:

| UI                  | Code                    | Meaning                                                                                          |
| ------------------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| Schule              | `School`                | A school using Studienbuch, with its rules (`SchoolRules`)                                       |
| Schulprofil         | `SchoolProfile`         | One school's conventions and timetable source                                                    |
| Schuljahr, Halbjahr | `SchoolYear`, `Term`    | The school year and its halves                                                                   |
| Ferien, Feiertag    | `Closure`               | Dates without school                                                                             |
| Stunde, Block       | `Period`                | A named time slot of the school day                                                              |
| Jahrgang, Klasse    | `Cohort`, `SchoolClass` | Students who entered together, and a class within a cohort in one year                           |
| Fach, Kurs          | `Subject`, `Course`     | Mathematik; a lasting teaching group such as "MA23"                                              |
| Kurswahl            | `Enrollment`            | The courses a student takes in one term                                                          |
| Stunde (im Plan)    | `Lesson`                | One dated lesson with teacher, room and any change                                               |
| Vertretung, Entfall | `ChangeKind`            | What changed about a lesson                                                                      |
| Stand               | `ImportStatus`          | When the school data was last imported                                                           |
| Mein Studienbuch    | `Notebook`              | A student's personal space at one school                                                         |
| Hausaufgabe         | `Homework`              | A task for a course with a due date                                                              |
| Note                | `Grade`                 | One grade: Klausur (`Written`), mündlich (`Oral`) or Gesamtnote (`Overall`)                      |
| Fehltag             | `Absence`               | One reported day of absence with its courses and reason                                          |
| Unterschrift        | `Signature`             | A drawing captured on the student's device. It proves nothing about identity                     |
| Konto, Zugangscode  | `Account`, `AccessCode` | A login, and the one-time code that grants it a school                                           |
| Notfallkarte        | `RecoveryCode`          | A saved code that restores the account's key on a new device                                     |
| Gerät koppeln       | `Pairing`               | Moving the key to a new device by QR code                                                        |
|                     | `Space`                 | The unit of sync: a set of rows and its members                                                  |
|                     | `Membership`            | Who receives a space, with a role                                                                |
|                     | `Mutator`               | A named, pure change to rows. It runs on the device, and for readable tables again on the server |
|                     | `Refusal`               | A mutator's typed reason to reject a change, shown as "Nicht übernommen"                         |
| Schlüssel           | `SpaceKey`              | The key of one encrypted space in one epoch. Only members' devices hold it                       |

## The five ways to hurt yourself

1. **Killing by pattern.** Kill only a PID you captured at spawn, or the owner of your port from `ss -H -ltnp` after confirming `/proc/<pid>/cwd` is your worktree. Your own agent process has this worktree's path in its argv, and the host runs other agents' dev servers.
2. **Logging beta out of WebUntis.** Two logins with one WebUntis account log each other out, and beta imports live with the school's account. Develop and test the import against the anonymized corpus. A live login from anywhere else needs Hauke's go and beta's import paused first.
3. **Baking in an origin.** One web build serves every preview, beta and later prod, and it calls the server on its own origin. Web code uses relative URLs. `EXPO_PUBLIC_API_URL` exists for native builds only, set per EAS environment.
4. **Leaking plaintext.** Content of encrypted tables exists in plaintext only on devices. Logs, spans, error messages, the command log, Postgres, dumps and the blob store carry ids, tags and ciphertext. Real names and real student data stay out of fixtures, logs and the repository.
5. **Changing srv-2 by hand.** Previews, beta, their databases, the app stores and EAS change only through the pipeline (Calder and the Alchemy stack). Reading status and logs is fine. Anything that writes needs Hauke's go at the time.

## Hit every surface

The most common defect is a change that works where you tested it and is missing everywhere else. Before calling work done, walk this list and say which entries applied:

- **Platforms.** iOS, Android and the web app under `/app`. A native-only API needs a web answer, and the reverse.
- **Apps.** The Expo app, the landing page (it renders app components) and the operator console.
- **Offline.** The change works offline, survives a restart and converges after reconnecting. A refusal shows with its reason.
- **Two devices.** The same student on two devices, or `?device=a` and `?device=b` side by side, ends in the same state.
- **Table class.** Readable tables (school data, `Enrollment`) and encrypted tables (notebook content) take different write paths. A mutator writes one class only.
- **Old clients.** The server deploys before clients, so the app one release back must keep working against the new server. Stored row JSON changes additively; a breaking change gets a new table name.
- **Reverse states.** A way in needs a way out and a way to see it.
- **Docs.** Check whether the change makes this file, an ADR or a scenario contract wrong.

## Dev environment

devenv on localhost is the dev environment, one instance per worktree ([ADR 0006](docs/adr/0006-fleet-service-instead-of-the-project-sdk.md)).

- `devenv shell` (or direnv) provides Node and pnpm from `nix/toolchain.nix`. `pnpm install` installs.
- `devenv up` starts the dev instance once M0 adds its processes: PostgreSQL 18, Garage for blobs, captured mail, and the server as the one origin in front of Vite (`/`, `/console`) and Metro (`/app`). Ports are allocated per worktree, so read them from devenv's output.
- Test in browsers, iOS simulators and Android emulators whenever it helps. That never needs permission. Use agent-browser or Playwright against localhost, and run iOS work on m1 through `builder-control`.
- Stop what you started, by the PID you captured (rule 1).
- Commands have one home each, and there is no Justfile ([ADR 0009](docs/adr/0009-no-justfile.md)): tools run directly (`vp check`, `vp test`), a package's commands are scripts in its `package.json` run with `vp run`, long-running processes belong to devenv, and CI is `.calder/ci.ts`.

## Test data

An empty database is a bad test.

- The demo school: `prepare` seeds it deterministically when `STUDIENBUCH_DEMO_SCHOOL=seed`, with personas (two students, a teacher, a parent). Dev instances and previews offer "sign in as" for them.
- The import runs against an anonymized WebUntis corpus that lives outside this public repository. Real WebUntis data stays out of the tree.
- E2E tests create their own school per run, so they can run against previews and beta without a reset.

## Verifying

- Before every push, run `calder check`. It runs `.calder/ci.ts` on your working copy like a PR, and the push reuses its results.
- While you iterate, run `vp check` (format, lint, types) and `vp test run <files>`.
- Test behavior that can break: the sync engine (outbox, rebase, refusals, convergence), encryption formats and key handling, migrations, import parsing and projection, school rules, auth and membership guards, and the logic a bug fix changed. Leave out what types guarantee, trivial code, copy text, smoke runs and mock-call mirrors.
- Extend before you add: when an existing test covers the behavior, add a row or an assertion there. Test at one layer, the lowest one that fails without your change.
- Tests sit next to their module (`Homework.test.ts`), use `@effect/vitest`, and replace dependencies through Layers, never module mocks.
- Tests are deterministic. `it.effect` runs on a `TestClock`. Await the `Deferred`, take from the `Queue` or drain the worker. A test that needs a sleep, a polling loop, a timeout or a retry to pass is wrong.
- Proof for a bug fix depends on the bug. Logic, data, state and protocol bugs get a failing test first, then the fix. Visual bugs get before and after screenshots and no test.
- Look at every user-visible change in a real client before you call it done: a browser on localhost, an iOS simulator, an Android emulator. Claim only what you saw in this session.

## Pull requests

Agents work through pull requests ([ADR 0008](docs/adr/0008-agents-work-through-pull-requests.md)).

- Work in your own jj workspace. Pull `main` with `jj-pull main` before you start and again during long tasks. Your brief names the files you own; when parallel packages run, ownership is exclusive.
- Commit with conventional titles in plain language: `fix(app): a refused homework entry keeps its reason`. The body says the problem in a sentence or two, then how you fixed it.
- Push a bookmark to Gitea (`origin`, git.schnau.dev) and open the PR there with `tea`. GitHub is a mirror for outside contributors.
- A PR that changes what a user sees links its preview and shows before and after screenshots.
- The orchestrator merges once checks pass and the preview looks right. Hauke can open any preview and never has to review code.
- The catalog in `pnpm-workspace.yaml` is append-only while packages run in parallel: add entries only for dependencies you introduce. Regenerate `pnpm-lock.yaml` with `pnpm install` after a rebase, never merge it by hand.

## Documentation

Most code changes need no documentation change. Agents can read the code.

- `docs/adr/` holds one decision per file: the context, the decision and why, in a few sentences. Write one when a decision is hard to reverse, surprising without context, and the result of a real trade-off. A changed decision gets a new ADR that supersedes the old one.
- `docs/product/` holds the legacy behavior catalogue and the scenario contracts. A scenario states a user-visible rule independent of any test runner; the E2E test implements it.
- `docs/operations/` holds procedures for running, releasing and debugging.
- Document reasons and constraints the code can't show. Leave out feature lists, field lists, control-flow narration and PR summaries. When a documented decision changes, rewrite the text instead of appending.
- Plans, research notes and scratch files stay out of the tree. The rewrite's roadmap and design documents are at <https://files.schnau.dev/html/studienbuch-roadmap/> (Tailnet), and ADRs link into them.

## How it works

Every synced row lives in exactly one space: a student's notebook, a school, a course, and later chats and family spaces. Membership is the only read rule. Devices push commands and pull rows. A command runs its mutator from `packages/core` against local SQLite, so the screen updates at once, and waits in the outbox until the server settles it. For readable tables (`Mutate`), the server runs the same mutator again and may refuse it. For encrypted tables (`Seal`), the device's result is authoritative, and the server checks membership, key epoch, base version and signatures without reading the content. Rows come back by per-space version cursors, and a device's view is always its base rows plus a replay of its outbox. The WebUntis import is a job inside the server: a school profile turns provider records into rows, and `SyncWriter` writes them on the same versioned path. CI builds one architecture-independent JS bundle (server, landing page and console, Expo web export), and srv-2 runs it with its own Node 26 as a `Fleet.Service`, one per preview and one for beta. Native builds reach phones through TestFlight and Play internal, and JS changes through EAS Update.

## Where code lives

The layout below is the target. Packages appear as M0 builds them.

| Path                          | Owns                                                                                                                                                                  | Must not                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/app`                    | Expo Router routes, features wired to live queries, the SQLite drivers, the native crypto layer, keychain access                                                      | contain domain rules                                                    |
| `apps/web`                    | Landing and legal pages through react-native-web, the console SPA                                                                                                     | import `packages/sync`                                                  |
| `apps/server`                 | The four commands (`serve`, `prepare`, `console`, `verify`), HTTP routes, RPC handlers, Better Auth, Drizzle schema and migrations, jobs, school profiles, the import | contain native addons or Expo packages                                  |
| `packages/core`               | The domain: row tables, mutators, membership rules, `SchoolRules`, refusal tags, civil time                                                                           | import React, React Native, Expo, `node:*` or the sync client or server |
| `packages/sync`               | The engine. Root: definition API, `Tx`, wire protocol. `./client`, `./server`, `./testing` (simulation and Sync Lab)                                                  | let `client` import `server` or the reverse                             |
| `packages/e2ee`               | Envelopes, key boxes, signatures, recovery and pairing over a `CryptoSuite` service                                                                                   | store anything or open a connection                                     |
| `packages/api`                | Effect RPC groups and schemas outside sync                                                                                                                            | hold handlers                                                           |
| `packages/ui`                 | Design tokens, fonts, icons, domain-free components                                                                                                                   | know a domain type                                                      |
| `packages/domain-ui`          | Dumb components shared by the app and the landing page: rows and callbacks in                                                                                         | read SQLite or the sync engine                                          |
| `deploy/`, `.calder/`, `nix/` | The Alchemy stack, CI, bundle derivations and checks                                                                                                                  |                                                                         |
| `tools/oxlint/`               | Local lint plugins                                                                                                                                                    |                                                                         |

Code in `packages/core`, `packages/sync` and `packages/e2ee` also runs on Hermes, which lacks `Temporal`, `toSorted`, `toReversed`, `toSpliced` and `Intl.Segmenter`.

## Taste

- Complexity belongs at the adapter boundary. Orchestration stays pure, UI stays dumb.
- Inferred types over annotations. `any` is the enemy.
- Effect Schema parses every boundary: HTTP, RPC, environment, storage, JSON.
- Nothing throws, anywhere, and `Promise.reject` or `assert` don't stand in for it. Errors are tagged values in Effect's error channel, named `Domain.ClassName` without an `Error` suffix. Defects use `Effect.die`. `Option` means absence, never a failed parse.
- `exactOptionalPropertyTypes` stays off on purpose. Don't propose turning it on.
- Mutators read no clock, randomness, network or SQL. Ids and timestamps arrive as arguments. Civil time follows [ADR 0001](docs/adr/0001-model-civil-time-explicitly.md).
- A public module is one PascalCase file that exports itself as a namespace (`export * as Homework from "./Homework.ts"` inside `Homework.ts`), imported as `import { Homework } from "./Homework.ts"`. No `import * as` for our own modules and no split into two files. Effect modules keep `import * as Effect from "effect/Effect"`.
- Data and subscriptions belong in atoms. A React effect synchronizes with something outside React.
- Comments state a reason the code can't show, describe how a function is used, and move with the code. A lint suppression carries its reason.
- If a rule here fights the task in front of you, say so loudly and get a human sign-off before breaking it.

## Effect

- `effect` and every `@effect/*` sit at one exact version in the catalog and move together. Most modules we use are marked unstable and change in patch releases, so read the changelog on every bump.
- Before designing Effect-heavy code, check whether Effect already supplies the schema, error, concurrency, lifecycle, scheduling, SQL, RPC or testing abstraction the problem needs.
- The installed package source is the authority on exact behavior. `~/context/effect-ts-effect` (checked out at the pinned tag) and `~/context/effect-ts-website` hold upstream source and docs. Check APIs there rather than from memory or another release.
- Reusable Effect functions use `Effect.fn("Service.operation")`, which names their span.

## Directory naming

A directory name answers **why this code exists**, never **what kind of file it is**. There are two reasons to exist: the problem (domain) or a technology choice (infrastructure). The top level of every app and package makes which one visible. The test: swap the technology, which directories change? Change the product, which change? A directory that would change for both is misnamed.

`lib`, `utils`, `helpers`, `common`, `shared`, `misc` and `types` are not directory names. They describe file kinds, attract anything without an obvious home, and stop explaining themselves once they hold two things.

Apps use:

```
src/routes/ | src/app/   delivery surface, shaped by the framework
src/features/            domain, one directory per domain area
src/domain-ui/           UI that knows the domain, used by this app only
src/ui/                  design system pieces used by this app only
src/infra/               exists because of a technology choice
```

In packages, top-level files are the entry points named in `package.json`; everything else is a directory named for a domain question.

## Reference repos

- The old tree: the `legacy-2026-10` bookmark. Read a file with `jj file show -r legacy-2026-10 <path>`.
- T3 Code (`~/context/pingdotgg-t3code`): the primary reference for client and server structure and Effect-heavy architecture. Studienbuch needs a stronger offline story than T3 Code has.
- The legacy Flutter app, in production today, is the visual and behavioral reference for the app: `~/Code/Studienbuch-legacy/apps/flutter`, with an older copy in `~/context/studienbuch-archive/Stubu-legacy-flutter/apps/flutter`. The legacy React Native app (`~/context/studienbuch-archive/Studienbuch-Legacy/packages/app-mobile`) is the secondary reference. `docs/product/legacy-behavior/` records what they teach.
- Sync: Groundswell (`~/context/schnau-dev-Groundswell`) and LiveStore (`~/context/livestorejs-livestore`) as comparison points before inventing an abstraction.
- WebUntis: `@schnau/webuntis-api` in `~/Code/webuntis-api`.
- History only, never authoritative: `~/context/studienbuch-history/2026-04-02-b325561` and `~/context/studienbuch-archive` (`expo-54`, `native-release`, `Experiments`).

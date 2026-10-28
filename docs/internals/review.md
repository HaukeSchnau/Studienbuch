# Reviewing a pull request

What a reviewer agent checks in a Studienbuch PR, beyond what `vp check` and CI already prove. AGENTS.md holds the rules for writing the code. This file lists what lint and CI can't check. When a rule moves, change both.

Until WP-15 lands, CI (`.calder/ci.ts`) runs format and lint only. Lint reports type errors too, but nothing runs knip or the tests. Ask which tests the author ran, or run them yourself: `vp run check:changed`, and `vp test run` in the package for the rest. Tests that need PostgreSQL get it from `devenv up`.

## Reporting

- A finding names the file and line, the input or sequence that breaks it, and what the user, device or operator then sees. Without a failing scenario it is a question, so label it as one.
- Put harm first: leaked plaintext or lost data, then a broken old client or deploy, then wrong behavior, then missing proof.
- Read the PR against AGENTS.md's "Hit every surface". The PR says which entries applied. An entry that applies and goes unmentioned is a finding.

## What not to report

- What lint and the type checker enforce, as AGENTS.md's "Lint" section lists. A green `vp check` or CI lint run means those held. When a rule fights a real need, say so in a note; the rule changes in its own PR.
- Style and naming preferences with no failure behind them.
- Tests that AGENTS.md's "Verifying" leaves out. See [Tests](#tests).
- Same-user isolation of credentials outside Calder on m1 and the build boxes. See [Trust model](#trust-model).

## Trust model

m1 and the build boxes, which run Calder jobs and Nix builds, run only code Hauke trusts, so their jobs run as his user on purpose (D62). Skip findings that a job there can reach credentials outside Calder that the same user holds, such as the login keychain.

Still report:

- A step that gets a secret it doesn't need. App Store and Play keys reach only the TestFlight and store steps (D57).
- Any change that lets untrusted code run on m1 or a build box, such as a job that builds a fork's PR or a PR from the GitHub mirror.

srv-2 is different. Previews, beta and later prod share it, and separate users, database roles, credential directories and memory limits keep them apart (D33). A change that lets a preview reach beta's data or credentials is a finding.

## Sync and conformance

- Every synced row lives in exactly one space, and membership is the only read rule. A read path that filters on anything else is a finding.
- Only the server writes School and Course spaces. A client mutator that touches them is a finding.
- A mutator writes only readable or only encrypted tables, takes ids and timestamps as arguments, and refuses with a typed `Refusal` that the device shows as "Nicht übernommen".
- A refused command still advances the device's last mutation id, and its refusal reaches the device that sent it. Mutation ids per device stay gapless.
- A device's view is its base rows plus a replay of its outbox. Base rows hold server state only, so code that writes an optimistic result into them breaks convergence.
- A change to `Tx`, `CanonicalJson` or an engine adapter needs a hand-written case in `packages/sync/src/conformance/Cases.ts`. The conformance test runs it on sqlite-wasm, sqlite-node, PGlite and PostgreSQL 18 and writes the outcomes to `cases.jsonl`. A changed outcome on an existing line changes stored data, and the PR has to explain it.
- Engine SQL stays within SQLite 3.50, the oldest build (ADR 0013).

## Encryption and secrets

- Grades, absences, homework, signatures, photos and the display name exist in plaintext only on devices. Check every new log line, span attribute, error message, refusal, command log entry and blob: they carry ids, tags and ciphertext. An error that keeps a decoded row as its cause leaks it.
- The server checks an encrypted write's membership, key epoch, base version and signatures without reading it, and never runs its mutator. The write is a compare-and-swap on the row version.
- The envelope has a version byte and every box a suite id. A new algorithm is a new suite id, not a migration, and fields inside the ciphertext change additively, like row JSON. A format change ships with test vectors.
- Demo accounts are the only accounts whose root key the server can derive, and no user-facing call can mark an account as demo.
- A device accepts a recovered root key only after the wrapper's signed statement, its anchor and every link of the key chain verify.
- Secrets come from an environment variable or its `<NAME>_FILE` (ADR 0004), are read as `Config.Redacted`, and stay out of the repository, fixtures, logs and `EXPO_PUBLIC_*`. Real names and real student data stay out of fixtures too.

## Deploy order and rollback

- On `main` the server deploys first. OTA, TestFlight and Play follow once readiness reports the new revision. The app one release back must keep working against the new server: RPC schemas and stored row JSON change additively, a breaking row change gets a new table name, and commands travel as `name@version` with pure upgrade chains kept for 12 months.
- A command newer than the server knows gets `Retry`, not a refusal, because it means a rollout race.
- A rollback runs the previous server on the new schema. `serve` accepts a schema ahead of the code and stops on one behind it, so the previous release has to work with every migration the PR adds.
- When `prepare` fails, the old version keeps serving. Everything `prepare` does, the demo school seed included, must be safe to run again.
- A new environment variable joins the runtime contract (ADR 0004). `STUDIENBUCH_ENVIRONMENT` gates development features and nothing else, and one web build serves every preview, beta and prod.

## Migrations

- drizzle-kit generates the server's migrations from the Drizzle declarations (`vp run db:generate` in `apps/server`). A hand-written or hand-edited `migration.sql` is a finding.
- An applied migration never changes. The runner checks hashes and stops `prepare` on a mismatch (`apps/server/src/infra/database/Migrations.ts`).
- Migrations expand, then contract. A release adds tables and columns and stops reading the old shape; a later release drops it. Dropping or renaming what the previous release reads breaks rollback.
- Effect's `cluster_*` tables migrate themselves and stay out of drizzle-kit.
- Device migrations come from drizzle-kit too. A phone may skip releases and sit offline for weeks, so its migrations run from any older schema and keep the outbox.

## Leases and races

- Calder holds the project's deploy lease, latest wins, and `Fleet.Service` sends its fence, which the host refuses when it is lower. A deploy step in `.calder/` or `deploy/` that runs outside the lease or drops the fence lets an older revision overwrite a newer one.
- `prepare` migrates under an advisory lock, because a retry and a second instance can run it at once.
- Jobs run through `ClusterCron` on a `SingleRunner` (ADR 0011). Runs never overlap and missed runs catch up in order, so a job has to cope with several runs back to back after downtime.
- On the web, one tab owns a device's database through a Web Lock taken before the SQLite worker starts (ADR 0014). Code that opens the device database without it leaves a second tab waiting forever.
- On the server, a space's version is bumped under a row lock, so version order equals commit order. A pull reads in one `REPEATABLE READ` snapshot, and the last mutation id never leads the rows. A change to push or pull needs a concurrency test on real PostgreSQL 18, as in `packages/sync/src/server/PostgresTx.test.ts`.
- A race fix comes with a test that fails without it. The test awaits a `Deferred` or a `Queue`, or drives the `TestClock`.

## Offline

- Screens read local SQLite and never wait for the network. A screen that waits for an RPC before it shows local data is a finding.
- A write lands in the local database and the outbox in one transaction and shows at once. A write that goes straight to an RPC, or shows only after the server answers, breaks offline.
- A refusal stays on screen with its reason.
- The change survives a restart and converges after reconnecting, and two devices (`?device=a` and `?device=b`) end in the same state. The scenario contracts in `docs/product/scenarios/` describe these journeys, such as `offline-absence-survives-and-converges.md`.

## The hooks rule

`studienbuch/no-ad-hoc-state-or-effects` allows React's state, effect and memoization hooks only in an exported `use…` hook with a doc comment. Lint checks where they are called. Review checks the rest:

- State lives in its home: domain data in SQLite through live-query atoms, navigation and selection in the router, drafts in persisted atoms. A custom hook that copies any of these into `useState` is a finding.
- The doc comment states the hook's purpose and contract. A hook that exists only to hold one component's `useEffect` is a finding, because its state belongs in one of the homes above.
- A suppression of the rule names a real reason, such as a React Compiler bailout.
- The React Compiler memoizes. A handler that needs one identity uses `useStableCallback` from `@stu/ui`, not `useCallback`.

## Design against the mocks

- Variant B (D46): the operating system draws navigation, the tab bar, toolbar buttons, sheets, menus, pickers and alerts. Studienbuch draws the content with tokens from `packages/ui`. Custom chrome on iOS or Android is a finding. On the web we draw the chrome too, from the same tokens.
- Compare the PR's screenshots with the B boards of the [design mocks](https://files.schnau.dev/html/studienbuch-roadmap/design/mocks/index.html?board=today-B) (`today-B`, `week-B`, `grades-B`) and with the legacy Flutter app, which is the behavioral reference.
- Colors, radii, spacing and type come from tokens. Content uses Nunito and native chrome the system font (D47). Android uses our static colors, not the wallpaper's (D48). Subject colors come from the curated palette by subject (D49).
- Text scales with the system font size. A dense layout switches at large sizes instead of shrinking or clipping, as the week grid does.
- A visible change shows light and dark mode (D51), links its preview, and has before and after screenshots.

## Tests

- Ask for a missing test only when it would catch a real regression in what AGENTS.md's "Verifying" lists: the sync engine, encryption formats and key handling, migrations, import parsing and projection, school rules, auth and membership guards, and the logic a bug fix changed.
- Don't ask for one assertion per constant, label, copy text or `switch` case, for a smoke run, or for a test that mirrors mock calls.
- Flag a new test that breaks those rules and name the fix: fold it into the existing case or table, delete it, or keep it at one layer.
- A logic, data, state or protocol fix needs a test that fails without it. A visual fix needs before and after screenshots and no test, so don't ask for one.

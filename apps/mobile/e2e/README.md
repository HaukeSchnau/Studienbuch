# Paired mobile end-to-end tests

Studienbuch is evaluating Argent and agent-device against the same scenarios. The comparison is
only useful if product coverage remains identical, so the runner-neutral contracts in `scenarios/`
are the source of truth. For a scenario named `<id>` on `<platform>`, both of these recorded files
must exist:

- `apps/mobile/e2e/agent-device/<platform>/<id>.ad`
- `.argent/flows/<platform>/<id>.yaml`

The comparison harness refuses to run an unpaired scenario. Generated reports live under
`test-results/mobile-e2e/`, which is ignored by version control. Repository QA runs a static parity
check: one runner implementation can never land without its counterpart; contracts may remain
pending until a live authoring device is available.

## Authoring a scenario

1. Write or update `scenarios/<id>.md` with user-visible preconditions, actions, and assertions.
2. Put the app in the declared precondition on a real simulator, emulator, or device.
3. Record the agent-device path with `open ... --save-script`, semantic targets, recorded hard
   checks, a destination guard, and `session save-script`. Save it at the paired path above.
4. Start an Argent flow recording, execute every interaction through `flow-add-step`, add hard
   structural assertions, and finish the recording. Save it at the paired path above.
5. Replay the unchanged agent-device script twice. Then stop only the scoped Argent services and
   replay the unchanged Argent YAML twice. Do not commit a snapshot baseline until a human has
   reviewed it.
6. Run `just mobile-e2e <platform> <id>` to preserve one report containing both exit results and
   durations.

Never hand-author an Argent flow or reconstruct one from memory. Do not hand-author an
agent-device script when a live recording is possible. A device-less agent may improve contracts,
the harness, or application accessibility identifiers, but must leave runner artifacts to an agent
that can record and verify them.

## Comparing the runners

Use the same app build, device model, OS version, network conditions, and reset procedure for both
runs. Alternate order with `MOBILE_E2E_ORDER=argent-first` to expose warm-cache and state bias.
Set `MOBILE_E2E_DEVICE` when auto-detection could select different devices. Runtime reports capture
versions, order, exit codes, and wall-clock duration; use repository history and agent-thread history
to compare authoring effort, repair effort, and churn.

Do not choose a winner from one smoke test. Accumulate representative setup, offline, sync,
reconnect, validation, navigation, and failure-recovery scenarios, then compare pass rate, flake
rate, median and tail duration, diagnostic quality, maintenance churn, and agent effort.

## Commands

```sh
just mobile-e2e android startup
just mobile-e2e-agent-device android startup
just mobile-e2e-argent android startup
```

The optional environment variables are `MOBILE_E2E_DEVICE`, `MOBILE_E2E_ORDER` (`agent-device-first`
or `argent-first`), and `MOBILE_E2E_TIMEOUT_MS`.

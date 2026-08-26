# `@stu/observability`

Shared observability vocabulary and the client telemetry channel. Effect and OpenTelemetry own
traces, logs, and metrics; Sentry stays narrowly scoped to crash reporting.

## Entry points

| Subpath     | For                                                                           |
| ----------- | ----------------------------------------------------------------------------- |
| `.`         | Resource identity, span/metric attribute vocabulary, the server canary        |
| `./server`  | OTLP layers, development and production loggers, `flushOtlp`                  |
| `./browser` | The client envelope contract, the telemetry outbox, W3C trace-context helpers |
| `./testing` | Test helpers                                                                  |

`./browser` is safe in every client bundle: it pulls in no Node built-ins and no server modules.

## Layout

`index.ts`, `server.ts`, `browser.ts` and `testing.ts` are the four package exports and hold nothing
but re-exports. Implementation sits in `opentelemetry/` (resource identity, the span and
metric attribute vocabulary, and W3C trace-context propagation -- the parts OpenTelemetry defines),
`otlp/` (exporter layers, config, canary) and `client/` (the envelope contract and the outbox).

## The client telemetry channel

Web and mobile report a narrow, allowlisted set of operational records to the Studienbuch server,
which ingests them into the same Effect runtime as server telemetry and exports them over OTLP. The
fleet collector is never reachable from a public client.

### One contract

`client/envelope.ts` is the whole protocol:

- `ClientTelemetryEnvelope` — what a client sends. Records are a closed union of span, log, and
  metric shapes with literal names and literal attribute values. There is no free-text field, so no
  student identifier, URL, or message can be smuggled through. The server decodes with
  `onExcessProperty: "error"`.
- `ClientTelemetryAcknowledgement` — what the ingress answers: `{ acceptedRecords }` with `202`.
  `acceptedRecords` may be lower than the number sent; the client keeps the remainder queued and
  retries it.

Both the server handler and every client transport decode these same definitions. Adding a record
type means editing this file and nothing else.

### One queue

`TelemetryOutbox` is the only client-side queue. It is an Effect service built from storage and
delivery services; `Ref`, `Semaphore`, `Clock`, and `Random` own its state, serialization, time, and
retry jitter. Platform differences stay at the layer boundary rather than producing queue copies:

| Service             | Browser                            | Mobile                  |
| ------------------- | ---------------------------------- | ----------------------- |
| `TelemetryStorage`  | `memoryTelemetryStorage()`         | Expo document directory |
| `TelemetryDelivery` | same-origin `fetch` + `sendBeacon` | authenticated `fetch`   |
| Effect `Clock`      | browser clock adapter              | runtime clock           |
| Effect `Random`     | browser randomness adapter         | runtime randomness      |

It guarantees: bounded memory by bytes and optionally by record count, oldest-low-priority-first
eviction so failures survive a full queue, per-record jittered exponential backoff, age expiry,
partial-acceptance retention, and serialized access so concurrent flushes cannot interleave. A
teardown beacon ignores backoff, because there is no later attempt.

Every flush appends `studienbuch_client_outbox_depth` and
`studienbuch_client_outbox_dropped_total`, so a client that is silently dropping telemetry still
says so.

### Two admission paths, one handler

The ingress at `/api/observability/v1/telemetry` admits:

1. **Browsers** — an `Origin` header matching the request origin. Costs no session lookup.
2. **Native clients** — a resolvable Better Auth session. Native clients send no `Origin` at all,
   which is why an origin-only check rejected every mobile envelope.

Anything else is refused. Rate limiting is keyed per principal rather than globally, so one noisy
client cannot starve the rest.

The limiter's window is per process, so N instances permit N times the configured rate. The real
bounds on this route are the 64 KiB body cap and the allowlisted schema; the limiter exists to stop
one client monopolising ingestion. Moving it to shared state is worthwhile only once there is more
than one instance.

## Verification

- `vp run --filter @stu/observability test` covers the envelope contract and the outbox.
- The Nix `releaseSmoke` check posts a real envelope through a running Release and asserts it
  reaches an OTLP collector, and that an unauthenticated envelope is refused. Both halves of this
  channel used to be tested only in isolation, which is how they came to disagree.

# Observability architecture research

Status: proposed target architecture, not yet implemented  
Last updated: 2026-08-12

## Goal

Build one coherent operational-observability system for Studienbuch around Effect v4 and OpenTelemetry:

- traces, structured logs, and metrics share one resource/attribute vocabulary;
- telemetry plumbing is installed once at each application runtime root;
- pure domain code remains independent of telemetry;
- server telemetry is reliable and vendor-neutral;
- browser and mobile telemetry respect public-client security and offline constraints;
- Grafana remains the primary query surface over the existing self-hosted backends;
- crash reporting and product analytics remain explicit adjacent systems rather than being mixed into operational telemetry.

The primary production backend is Hauke's existing self-hosted fleet. The application-facing contract is OTLP, so a future SaaS backend remains a collector configuration change rather than an application refactor.

## Current state

- `apps/console` is the only Effect runtime. It supplies `NodeServices.layer` directly and has no explicit logger, tracer, metrics exporter, resource identity, or telemetry config.
- `apps/web` initializes Sentry through `instrument.server.mjs`. It currently enables 100% trace sampling and 100% session replay sampling and uses Sentry-specific manual spans. This is isolated from Effect and the rest of the repository.
- `apps/web` also has PostHog, which is product analytics and should remain a separate concern.
- `apps/mobile` has EAS Observe for launch/update performance. There is no shared application telemetry contract or crash reporting. EAS Observe persists custom events on-device and sends them later, which is a useful durability property not provided by Effect's current in-memory OTLP exporter.
- `packages/core` is pure domain code. It should remain so.
- The project has no server application separate from TanStack Start yet.
- The private fleet already runs Grafana, VictoriaMetrics, VictoriaLogs, Tempo, Alertmanager, vmalert, per-host `vmagent`/`vlagent`, journald upload, node exporter, and blackbox probes. Tempo accepts OTLP/HTTP on loopback; VictoriaMetrics and VictoriaLogs expose their native OTLP ingestion paths. No OpenTelemetry Collector is installed yet.

## Decisions

### 1. OpenTelemetry is the wire contract; Effect owns application instrumentation

Application code uses Effect-native APIs:

- `Effect.fn("Module.operation")` and `Effect.withSpan` for operation boundaries;
- `Effect.annotateCurrentSpan` for detailed context;
- `Effect.log*` plus structured log annotations;
- `Metric.counter`, `Metric.gauge`, `Metric.histogram`, and `Metric.timer` for domain and runtime measurements;
- Effect HTTP client/server tracing for W3C `traceparent` propagation.

Only runtime wiring knows about OTLP exporters. Domain/application services do not call Sentry, Grafana, VictoriaMetrics, or OpenTelemetry SDK globals.

Effect v4 beta 107 already contains a combined OTLP logs/metrics/traces layer and individual `OtlpLogger`, `OtlpMetrics`, and `OtlpTracer` layers under `effect/unstable/observability`. These exporters batch, retry transient failures, flush on scoped shutdown, and temporarily disable themselves after repeated failures. They are not durable queues: failed in-memory buffers can be discarded. That is acceptable behind a local server collector but not sufficient as the only mobile delivery mechanism.

### 2. Add one shared `@stu/observability` package

This package should be the single home for telemetry policy and Effect integration. Proposed public areas:

```text
packages/observability/
  src/
    attributes.ts       # typed, approved attribute vocabulary and normalization
    metrics.ts          # metric definitions and reusable observation combinators
    operations.ts       # Effect/Stream boundary wrappers
    resource.ts         # canonical service/resource identity
    config.ts           # Effect Config recipes for runtime policy
    server.ts           # server/CLI logger, tracer, and metrics layers
    browser.ts          # public-client adapters and lifecycle handling
    mobile.ts           # mobile adapters and durable-delivery boundary
    testing.ts          # in-memory capture and OTLP contract test helpers
```

Do not make it a generic dumping ground or a second application framework. Its narrow responsibilities are vocabulary, policy, reusable instrumentation helpers, exporters/adapters, and test support.

`packages/core` must not depend on it. Instrument the Effect services that call pure domain functions, persistence adapters, sync workers, transports, and UI/application workflows. Pure selectors, formatters, schemas, and policies do not need spans.

### 3. Start with an integrated TanStack Start + Effect modular monolith

Do not introduce `apps/server` in the first implementation slice. Keep `apps/web` as one deployment unit, but establish a hard internal boundary:

- TanStack Start owns SSR, HTTP dispatch, web-only server functions, authentication cookies, and raw `/api/v1` routes.
- One process-wide Effect `ManagedRuntime` owns application services, persistence, sync workflows, configuration, and observability resources.
- Server functions are web adapters and raw server routes are public/mobile adapters. Both call the same Effect services; neither contains business logic.
- Pure shared domain logic remains in `packages/core`. Add a contracts package only when schemas must cross the public HTTP boundary.
- Keep server-only modules behind `.server.ts` or TanStack's server-only import protection so runtime authority cannot enter the browser bundle.

TanStack Start's custom fetch-style `src/server.ts`, global middleware, server functions, raw server routes, and typed request context are sufficient for this shape. An Effect `ManagedRuntime` caches one layer-built service graph across requests and owns its resource scope. Its disposal and OTLP flush must be wired to the actual Node/Nitro shutdown path and tested; do not create or rebuild the runtime per request.

This gives one origin, one authentication boundary, one deployment, direct SSR access, and one local development loop. It also avoids an internal HTTP hop and prevents duplicate TanStack/standalone transport implementations.

A separate `apps/server` remains a valid later extraction, but only when an operational boundary earns it. Extraction triggers are:

- the API/sync plane needs independent availability, rollout cadence, or scaling from SSR;
- long-lived WebSocket/SSE/sync sessions are disrupted by frontend deployments or awkward under Nitro's lifecycle;
- background workers need independent restart, resource limits, or singleton/leader ownership;
- multiple replicas would accidentally duplicate scheduled/background work;
- the mobile API becomes the dominant product boundary and TanStack's transport/runtime creates measurable friction;
- another frontend or integration needs the backend independently;
- the desired server runtime or placement diverges from the web runtime.

If extraction happens, move the existing Effect runtime composition and transport-independent services rather than rewriting them. Code duplication is not an inherent consequence of two deployables, but duplicated lifecycle, configuration, authentication, local development, and deployment plumbing are real costs and should be justified.

The console and integrated web server should each construct one named top-level layer graph. Observability is supplied at the runtime root, never repeatedly inside services.

### 4. Use an OpenTelemetry Collector as the server-side gateway

Add a pinned `otelcol-contrib` service to the private Nix fleet. The application contract becomes one standard loopback endpoint:

```text
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
OTEL_LOGS_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_TRACES_EXPORTER=otlp
OTEL_SERVICE_NAME=studienbuch-server
OTEL_RESOURCE_ATTRIBUTES=service.namespace=studienbuch,deployment.environment.name=production
```

Use OTLP/HTTP protobuf in server processes. The collector owns backend-specific routes, batching, retry, persistent sending queues, memory limits, resource enrichment, filtering, and defense-in-depth redaction.

Recommended collector topology:

```text
server / console
      |
      | OTLP/HTTP on loopback
      v
per-host collector agent
      |
      | authenticated OTLP over Tailnet when remote
      v
srv-1 collector gateway
      +--> Tempo          (traces)
      +--> VictoriaMetrics (metrics)
      +--> VictoriaLogs    (logs)
```

For the initial single-host deployment, agent and gateway can be one collector process. Keep the configuration shaped so another host can add a local agent without changing applications.

Gateway processor baseline:

1. `memory_limiter`
2. resource detection/upsert for fleet-owned values
3. explicit attribute filtering/redaction
4. noise filters where evidence supports them
5. `batch`

Use exporter `sending_queue` with `file_storage` for persistence across collector restarts. Monitor the collector's own queue, refusal, drop, export-failure, memory, and throughput metrics. Tail sampling is a later capacity policy, not a day-one requirement.

Backend routes already available in the fleet:

- metrics: VictoriaMetrics `/opentelemetry/v1/metrics`, protobuf;
- logs: VictoriaLogs `/insert/opentelemetry/v1/logs`;
- traces: Tempo OTLP/HTTP receiver.

The current Tempo loopback receiver already owns port 4318 on `srv-1`. Move its internal receiver to another loopback port and let the collector own the conventional application-facing 4318 endpoint.

### 5. Keep server logs single-ingested

Do not blindly enable both central OTLP log export and the existing journald-to-VictoriaLogs path for the same production unit; that creates duplicate records.

Preferred end state:

- Effect emits structured logs and trace-correlated OTLP log records;
- the service may retain stdout/journald as a short-lived local emergency/debug path;
- the fleet log shipper excludes units whose logs are centrally shipped through OTLP, or the application profile omits the OTLP logger until that exclusion exists.

Until the exclusion is implemented, use structured JSON stdout/journald as the canonical server log transport and use `Logger.tracerLogger` to attach in-span logs to traces. Do not accept duplicate central ingestion as a permanent compromise.

Development uses `Logger.consolePretty()`. Production uses structured JSON if stdout is active. Minimum log and trace levels are Effect references supplied by config.

### 6. Treat public clients as a separate trust and durability boundary

Never ship a privileged collector/backend token in a web or mobile bundle. A public token is not a secret.

For browser telemetry:

- emit a deliberately small set of root interaction/navigation/network spans;
- propagate W3C trace context into API requests;
- send OTLP/HTTP through a same-origin, size-limited, rate-limited Studienbuch server endpoint;
- use strict CORS/CSP, payload-size limits, content-type checks, and server-side resource/attribute overwrites;
- do not accept client-provided `service.namespace`, deployment, tenant, or user identity as authoritative;
- batch and flush on visibility/page lifecycle events, accepting that browser delivery is best-effort.

For mobile telemetry:

- preserve EAS Observe for its native startup/update metrics while it remains useful;
- use a native crash SDK such as Sentry for symbolicated native and JavaScript crashes;
- do not rely on Effect's in-memory OTLP exporter for offline reliability;
- create a `TelemetryTransport`/outbox boundary backed by durable app storage before claiming reliable first-party trace/log delivery;
- bound the outbox by bytes and age, drop oldest low-priority records first, retry with jitter, honor connectivity and battery/background constraints, and expose queue depth/oldest-age/drop counters;
- issue short-lived, scoped ingest authority after authentication when possible. Pre-auth crash telemetry should remain on a purpose-built public crash/Expo channel rather than opening a general unauthenticated OTLP pipe.

EAS Observe custom events may serve as an interim durable mobile event adapter, but they are a separate backend. Avoid building a large provider-specific instrumentation vocabulary into application code.

### 7. Sentry is crash/error reporting, not the primary telemetry bus

Retain or add Sentry where it provides capabilities the self-hosted OTel stack does not cheaply replace:

- browser JavaScript error grouping and source maps;
- React Native/Hermes/native crash symbolication and release health;
- narrowly sampled, privacy-configured error replays if genuinely useful.

Disable duplicate Sentry APM tracing once Effect/OTLP traces are active. Replace direct `Sentry.startSpan` application instrumentation with Effect spans. Change the current 100% production trace/replay sampling before real user traffic. Errors reported to Sentry should carry the current OTel trace ID when available so the two systems can be cross-linked.

Error-only session replay is acceptable for student-facing screens after the privacy controls and masking behavior are verified. Normal-session replay remains disabled by default.

### 8. Product analytics and audit history are different systems

- PostHog answers product questions such as feature adoption and funnels. It does not receive operational stack traces or arbitrary application logs.
- Audit history records security/business facts that must be durable and explainable. It belongs in the domain/persistence model, not in best-effort telemetry.
- Health/readiness endpoints and blackbox probes remain explicit operational interfaces.

## Canonical telemetry model

### Resource identity

Every signal must set these deliberately:

- `service.namespace=studienbuch`
- `service.name`: stable runtime name, for example `studienbuch-server`, `studienbuch-web-client`, `studienbuch-mobile`, or `studienbuch-console`
- `service.version`: immutable application release/version
- `deployment.environment.name`: `development`, `test`, `staging`, or `production`
- `service.instance.id`: runtime instance identity where useful for traces/logs; do not promote it into every metric label

Add runtime/platform attributes only when queryable and bounded. The collector, not a public client, owns host and deployment identity.

### Span naming

Names are stable operation classes, never instances:

- `Sync.pull`
- `TaskRepository.save`
- `http GET /tasks/:taskId`
- `mobile.screen.tasks.interactive`

IDs, normalized outcomes, counts, and sizes are attributes. Never put user IDs, task IDs, URLs with query strings, filenames, or arbitrary error messages into span names.

Create spans at meaningful boundaries:

- inbound HTTP/RPC and outbound HTTP;
- public service methods and non-trivial workflows;
- database transactions/queries at repository boundaries;
- sync phases, queue handoffs, retries, conflicts, and durable commits;
- background passes and external provider calls;
- user-perceived mobile/web interactions.

Do not trace pure helpers or every React render.

### Metric policy

Metrics are for populations and trends. Labels must be bounded enums or small controlled sets.

Initial families should cover:

- HTTP/RPC rate, errors, and duration;
- sync attempt/result/duration, queue depth, oldest pending age, bytes/records transferred, retries, conflicts, and last-success age;
- persistence operation result/duration and pool/queue saturation;
- background worker passes, lag, restarts, and terminal failures;
- authentication outcomes using normalized reasons;
- client cold start/time-to-interactive, request duration/failure, outbox depth/age/drop count, and update/release identity;
- process/runtime and collector health through infrastructure exporters.

Never use raw user, school, class, course, task, session, request, trace, device, path, URL, or free-text values as metric labels. Detailed identifiers belong on privacy-reviewed spans/logs.

Prefer OpenTelemetry-style names and units in source, and configure VictoriaMetrics' OTLP-to-Prometheus naming conversion deliberately so Grafana/PromQL names are predictable.

### Privacy and redaction

Studienbuch handles student and school data, so telemetry is allowlist-based.

Forbidden by default:

- names, email addresses, license keys, auth/session tokens, cookies, and authorization headers;
- task text, grades/comments, school/class/course names, attachment names or contents;
- request/response bodies;
- URL query strings and raw dynamic route parameters;
- local database records and sync payloads;
- full errors from untrusted providers when they may echo inputs.

Use normalized error tags and reasons from typed Effect errors. If correlation to a person or installation is essential, derive a rotating pseudonymous identifier at a trusted boundary; do not emit the raw identifier and do not label metrics with it.

Enforce policy twice: typed constructors/helpers in `@stu/observability`, then collector processors as defense in depth. Add tests that fail when forbidden keys or high-cardinality fields enter approved helpers.

## Runtime layer shape

Conceptual server composition:

```ts
const ObservabilityLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* ObservabilityConfig;

    return Layer.mergeAll(
      loggerLayer(config),
      tracePolicyLayer(config),
      otlpSignalsLayer(config),
      httpHeaderRedactionLayer,
    );
  }),
);

const MainLive = ApplicationLive.pipe(
  Layer.provide(ObservabilityLive),
  Layer.provide(NodeServices.layer),
);
```

The exact dependency direction must be proven with the pinned Effect version. Keep the final graph flat, named, and topologically understandable. Long-lived exporters/workers are scoped layers; application shutdown must drain them with a bounded final flush.

Expose an explicit no-export/testing profile rather than sprinkling environment checks throughout application code.

## Verification and operability

### Initial retention defaults

There is no product-specific retention requirement yet. Start with the fleet's existing operational defaults and revisit them using observed volume and incident usefulness:

- metrics: 60 days;
- application logs: 14 days;
- traces: 7 days;
- Sentry errors and error-only replays: the configured Sentry plan retention, without an additional first-party copy;
- mobile telemetry outbox: at most 7 days and a strict byte cap, initially 10 MiB per installation, with oldest low-priority records dropped first.

Retention is a privacy and capacity control, not merely a storage setting. Record actual ingestion volume before extending it.

### Automated checks

- Unit-test attribute normalization, redaction, outcome mapping, and cardinality restrictions.
- Capture spans/logs/metrics with in-memory test layers and assert stable names, parentage, outcomes, and absence of sensitive values.
- Add an OTLP contract test that runs a real Effect program against a local fake receiver and verifies all three payload types plus shutdown flush.
- Add collector configuration validation to Nix checks.
- Add an integration smoke test that sends a known trace/log/metric through the collector and queries Tempo, VictoriaLogs, and VictoriaMetrics.
- Verify W3C parent/child continuity across browser/mobile -> server -> persistence/outbound HTTP.
- Verify exporter/collector outage behavior and mobile outbox recovery with real process/network interruption.

### Dashboards and alerts as code

Provision a Studienbuch overview with:

- availability, request rate/error/latency, and saturation;
- sync health and offline outbox health;
- current release/environment filters;
- collector accepted/refused/dropped/export-failed and queue metrics;
- links from metrics to example traces and from trace IDs to logs;
- release/deployment annotations.

Start with a small number of actionable alerts:

- sustained server error ratio;
- latency SLO burn;
- no successful sync/worker pass within a truthful window;
- growing/stale durable queues;
- telemetry collector export failures or drops;
- crash-free session regression from the crash system.

Do not alert on every individual exception.

## Implementation sequence

### Phase 0: contract and collector foundation

1. Create `@stu/observability` with resource identity, typed attributes, privacy rules, config, test capture, and a minimal Effect server profile.
2. Add the pinned collector to Nix with loopback OTLP, memory/batch/redaction processors, persistent queues, and exports to the existing three backends.
3. Add a reproducible local observability command and a real end-to-end smoke probe.
4. Provision the first Grafana dashboard and collector-health alerts.

Exit criterion: a canary Effect program emits one correlated trace/log/metric set visible in Grafana, and exporter/backend interruption behavior is tested.

### Phase 1: console canary and integrated Effect server root

1. Wire `apps/console` through the shared runtime layer as the smallest production-shaped canary.
2. Add the process-wide Effect runtime to `apps/web` and put server-side application workflows behind Effect services.
3. Instrument HTTP/RPC, persistence, sync, background-worker, and external-call boundaries.
4. Add RED and first local-first health metrics.

Exit criterion: a server request is traceable end to end, has correlated logs, updates bounded metrics, and produces no duplicate central logs.

### Phase 2: web boundary cleanup

1. Replace Sentry manual application spans with Effect spans.
2. Restrict Sentry to error/crash/source-map/replay responsibilities and safe sampling.
3. Add a minimal browser tracing profile and same-origin ingestion gateway.
4. Propagate `traceparent` into server requests and verify continuity.

Exit criterion: one browser interaction connects to its server trace without exposing a backend secret or collecting route/user PII.

### Phase 3: mobile reliability

1. Add native crash reporting and verify symbolication for EAS builds and updates.
2. Define the mobile Effect runtime boundary and adapter from Effect logs/spans to delivery.
3. Implement and failure-test the bounded durable telemetry outbox before enabling broad first-party OTLP export.
4. Keep EAS Observe only for native performance signals that remain uniquely useful; document the split.

Exit criterion: offline telemetry survives process restart within explicit bounds, flushes later, and its own drop/lag state is observable.

### Phase 4: SLOs, sampling, and advanced signals

1. Establish SLOs from observed baselines.
2. Enable Tempo span metrics/service graphs with a reviewed low-cardinality dimension set and VictoriaMetrics remote write.
3. Add tail sampling only when volume justifies it: preserve errors and slow traces plus a deterministic baseline sample.
4. Evaluate profiling and deeper mobile performance tooling from actual unresolved incidents, not as default data collection.

## Explicit non-goals for the first implementation

- tracing every function or render;
- recording request bodies, domain records, or arbitrary errors;
- 100% production replay or indefinite 100% tracing as a permanent setting;
- putting product analytics into metrics/logs;
- building a custom observability backend;
- making mobile delivery claims without a tested durable queue;
- adopting a second generic OpenTelemetry JavaScript SDK inside Effect runtimes unless a concrete missing capability requires an interop bridge.

## Open decisions before implementation

1. Confirm the integrated `apps/web` modular-monolith recommendation or choose an immediate standalone server despite its additional operational boundaries.
2. Prove the process-wide Effect runtime startup/disposal path under the pinned TanStack Start and Nitro versions before adding long-lived workers.
3. Define the authenticated public-client telemetry envelope, limits, and server-side attribute overwrites.

## Primary references

- Effect v4 beta 107 source in the pinned dependency and `~/context/effect-ts-effect`, especially `effect/unstable/observability`, `Tracer`, `Logger`, and Effect HTTP tracing.
- TanStack Start server entry point and request-context documentation: <https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point>
- TanStack Start server routes and server functions: <https://tanstack.com/start/latest/docs/framework/react/guide/server-routes> and <https://tanstack.com/start/latest/docs/framework/react/guide/server-functions>
- TanStack Start execution model and server-only import protection: <https://tanstack.com/start/latest/docs/framework/react/guide/execution-model>
- Nitro 3 runtime lifecycle source in the pinned dependency, especially `NitroRuntimeHooks.close` and runtime plugins.
- OpenTelemetry Collector overview and deployment patterns: <https://opentelemetry.io/docs/collector/>
- OpenTelemetry gateway pattern: <https://opentelemetry.io/docs/collector/deploy/gateway/>
- OpenTelemetry browser exporter constraints: <https://opentelemetry.io/docs/languages/js/exporters/>
- OpenTelemetry resource conventions: <https://opentelemetry.io/docs/concepts/resources/>
- OpenTelemetry security guidance: <https://opentelemetry.io/docs/security/>
- VictoriaMetrics OTLP metrics ingestion: <https://docs.victoriametrics.com/victoriametrics/integrations/opentelemetry/>
- VictoriaLogs OTLP log ingestion: <https://docs.victoriametrics.com/victorialogs/data-ingestion/opentelemetry/>
- Grafana Tempo collector setup: <https://grafana.com/docs/tempo/latest/set-up-for-tracing/instrument-send/set-up-collector/otel-collector/>
- Grafana Tempo metrics generator and service graphs: <https://grafana.com/docs/tempo/latest/metrics-from-traces/metrics-generator/>
- Expo EAS Observe custom event durability: <https://docs.expo.dev/eas/observe/events/>
- Expo Sentry integration: <https://docs.expo.dev/guides/using-sentry/>
- Local primary reference: T3 Code's `apps/server/src/observability`, relay observability, and operations documentation.

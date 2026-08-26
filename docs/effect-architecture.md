# Effect architecture

Effect is Studienbuch's application runtime, not a decorative wrapper around isolated functions.
Domain rules stay portable and explicit; platform details enter through services and layers; typed
errors remain values until a delivery boundary decides how to encode them.

The locked Effect version and its local source are authoritative. Several modules below are still
unstable, so adoption must begin with a small vertical slice and a source/docs review for the exact
locked release.

## Current choices

- `Schema` owns data that crosses a trust or process boundary. IDs are branded, timestamps use
  `DateTime`, and expected failures are schema errors.
- `Context`, `Layer`, and scoped resources own database pools, authentication, SMTP delivery,
  observability, cryptography, and request admission. Framework callbacks are thin Promise bridges
  over already-built Effect services.
- `Config` and `Redacted` own runtime configuration and credentials. `FileSystem` reads mounted
  credential files. Production SMTP configuration is validated while the application layer starts.
- `Crypto` owns secrets, hashes, and UUIDs. Platform code supplies the implementation; domain and
  server modules do not import Node's crypto API.
- `Clock`, `Ref`, and `Schedule` own time, in-process admission state, retry, and cadence. This keeps
  behavior testable without replacing global timers.
- Effect RPC is the default first-party application boundary. `@stu/api` owns RPC groups and their
  schemas; apps own HTTP, WebSocket, Expo, or test transports. Better Auth and genuinely HTTP-shaped
  integrations remain ordinary HTTP.
- Effect HTTP owns first-party client telemetry delivery. Web and mobile share request construction,
  status handling, and schema decoding while layers provide platform fetch and authentication.
  Browser teardown still uses `sendBeacon`, and the telemetry outbox remains the sole retry owner.
- `AtomRpc` is the web app's only first-party server-state cache and mutation runtime. Local form
  fields stay in component or form state.
- Drizzle's Effect PostgreSQL adapter remains the persistence boundary. Raw `pg` access is limited
  to adapters whose upstream API is Promise-only or where a single conditional SQL statement is
  the actual concurrency primitive.

## Likely next modules

These are candidates, not commitments:

| Product need                             | Effect candidates                                                         | Adoption rule                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline event history and sync           | `Event`, `EventGroup`, `EventJournal`, `EventLog`, `EventLogRemote`       | Compare a representative vertical slice with Groundswell and LiveStore first. The chosen model must work with Expo SQLite, replay, conflict handling, and server ingestion. |
| Ordered local work while offline         | `Queue`, `Stream`, `PubSub`; later `PersistedQueue`                       | Begin with in-memory coordination. Add persistence only when work must survive process death.                                                                               |
| Durable multi-step operations            | `Workflow`, `Activity`, `DurableClock`, `DurableDeferred`, `DurableQueue` | Use only for work that must resume after a crash or deployment. Emailing a verification link is not yet such a workflow.                                                    |
| Read batching and deduplication          | `Request`, `RequestResolver`, `SqlResolver`                               | Introduce when traces show repeated or N+1 reads; do not hide simple queries behind a resolver pre-emptively.                                                               |
| Small durable caches and device settings | `KeyValueStore`, `Persistence`, `PersistedCache`                          | Choose a platform adapter per app and define invalidation before adding a cache.                                                                                            |
| Shared rate limits                       | persistence `RateLimiter` with Redis                                      | Replace the in-process enrollment limiter when more than one web instance makes a global limit operationally meaningful.                                                    |
| Long-lived updates                       | RPC streams over WebSocket, backed by `Stream`/`PubSub`                   | Add for real-time collaborative or sync state, not for ordinary request/response screens.                                                                                   |

`Cluster`, sharding, entities, and distributed workflows are intentionally deferred. They solve a
different scale of coordination than Studienbuch currently has. A single PostgreSQL-backed service
is easier to operate and reason about until measured constraints prove otherwise.

## Boundary rules

Use RPC when both ends are Studienbuch clients, coordinated releases are realistic, and a typed
Effect error/success model is the useful contract. Expo OTA substantially reduces mobile version
skew, but additive schema evolution and tolerant clients are still expected.

Use HTTP API when HTTP semantics are part of the contract: public integrations, webhooks, cacheable
resources, redirects, file transfer, standards-based auth, or an OpenAPI-facing API. A project can
and should use both without wrapping one in the other.

At React boundaries, use atoms for durable server-derived state and mutations that invalidate it.
Keep ephemeral input, focus, disclosure, and animation state local. On mobile, the same rule applies
alongside the local database: synchronized projections belong in the local-first data layer, not in
a growing collection of remote query atoms.

## Web Router and Atom lifecycle

Each TanStack Router instance creates one `AtomRegistry`; React and route context receive that same
instance. This is important for server isolation and cache identity. A route loader and its component
must never create separate registries or parallel request caches.

Route responsibilities are deliberately narrow:

1. `beforeLoad` performs authentication and authorization and throws Router redirects before render.
2. `loaderDeps` reduces validated search or path input to the identity of the requested data.
3. `loader` awaits the relevant async atom through `AtomRegistry.getResult`. Router cancellation is
   passed to `Effect.runPromise`, so abandoned navigation interrupts acquisition.
4. The component reads the same atom with `useAtomSuspense`; the loader has already warmed it.
5. `AtomRpc` mutations declare reactivity keys for every query whose server-derived answer changed.

The registry's five-minute idle TTL controls disposal after an atom loses its last subscriber. It is
not a freshness interval and does not poll. Freshness comes from successful mutations and explicit
authorization refreshes. Named reactivity domains such as `account` and `reservation` describe what
changed; request payloads and atom-family arguments continue to define query identity.

Authentication and product routes live under the pathless `_client` route and have SSR disabled.
Public marketing and legal routes retain SSR. This avoids running session-bound application reads on
the server while preserving useful server-rendered documents.

Use `useEffect` only when React must synchronize with something outside React and no dedicated
subscription primitive exists. Browser stores use `useSyncExternalStore`; route acquisition and
redirects use Router lifecycle; values computable from props, state, or constants are derived during
render.

The remaining web effects each synchronize with an external lifecycle:

- the site header observes section intersection;
- pointer spot, pointer tilt, and the subject strip subscribe to browser animation or input;
- client observability owns Sentry loading and telemetry subscriptions;
- the app shell persists the selected context to browser storage;
- access completion redeems only after an authenticated component mounts, keeping mutations out of
  Router's intent-preload lifecycle.

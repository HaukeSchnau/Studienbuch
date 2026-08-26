# Web Effect Atom and Router plan

Updated: 2026-08-26

## Goal

Make Effect Atom the sole cache and mutation runtime for first-party application data in the web
client. TanStack Router decides when a route requires data and performs redirects before rendering.
React components read the same atoms that Router prepared.

The marketing site, Impressum, and Datenschutz keep server rendering. Authentication and product
routes run as a client application. TanStack Start continues to own the HTML shell and API routes.

## Scope

This plan covers:

- one Effect Atom registry per Router instance;
- one browser AtomRpc service for the merged `@stu/api` RPC group;
- Router guards and route-critical Atom queries;
- AtomRpc mutations and explicit invalidation;
- the selective SSR boundary;
- web effects identified by the React audit;
- route and Atom integration tests;
- the independent telemetry startup fix and cryptographic mobile telemetry IDs;
- dependency, Effect diagnostics, and web documentation cleanup.

This plan does not cover:

- mobile persistence, synchronization, or migration from `compat/mobile-v0.ts` to `@stu/core`;
- replacing mobile mock data with remote queries;
- the mobile clock, selection-state, route-date, or large-screen refactors from the broader audit;
- replacing Better Auth's session and passkey stores;
- moving form fields, focus, disclosure, or animation state into atoms;
- eliminating every `useEffect`.

The mobile app remains fixture-backed. The telemetry ID change is the only planned mobile source
change because it is an isolated security repair and does not touch the data model.

## Baseline

At revision `c4e0f3d2241f`:

- `accountAtom` is the only asynchronous web query atom;
- no web RPC mutation uses AtomRpc;
- feature code constructs two separate Promise-based RPC clients;
- the Atom registry is created inside React and is unavailable to Router loaders;
- all web routes use the default server-rendering policy;
- six web effects perform route reads or redirects;
- Better Auth correctly owns session, passkey, and WebAuthn state;
- the web test suite has infrastructure tests but no route or Atom integration tests;
- mobile data atoms are synchronous and seeded from fixtures.

## Architecture decisions

### One owner for each kind of state

| State or lifecycle                        | Owner                                            |
| ----------------------------------------- | ------------------------------------------------ |
| URL, search parameters, navigation        | TanStack Router                                  |
| Authentication and authorization redirect | Router `beforeLoad`                              |
| Route-critical read declaration           | Router loader                                    |
| RPC execution, caching, retention         | Effect Atom and `AtomRegistry`                   |
| Mutation state and query invalidation     | AtomRpc mutation and Effect reactivity           |
| Server-derived rendering state            | `useAtomSuspense` or `useAtomValue`              |
| Better Auth session and passkeys          | Better Auth                                      |
| Form inputs and transient interaction     | React or the form owner                          |
| Public page SSR data                      | TanStack Start loader or server function         |
| Mobile application data                   | Fixture-backed local atoms until a later project |

Router loaders prepare atoms. They do not return application data, because that would create a
second cache in Router loader data. A component reads the same atom from the same registry.

### Registry lifetime

`getRouter()` creates one `AtomRegistry` and places it in typed Router context. The root document
passes that exact registry to `RegistryContext.Provider`.

Do not use a module-global registry. Start may reuse a server module across requests, so a global
registry could expose one request's state to another request. Tests also need a fresh registry per
router.

Use an explicit default idle TTL of `300_000` milliseconds, or five minutes. `AtomRegistry.make`
takes this value as milliseconds. Per-query AtomRpc `timeToLive` accepts a Duration and may override
it when there is a concrete retention need. Both values control disposal after the last subscriber
leaves. They do not control freshness or polling.

### Router bridge

Add one small adapter that turns an asynchronous atom into an abortable loader Effect:

```ts
const getAtomResult = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  signal: AbortSignal,
) =>
  Effect.runPromise(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }), { signal });
```

The adapter earns its place because it binds Router cancellation to Effect interruption. Do not add
wrappers that only rename `useAtomValue`, `useAtomSet`, or casts.

### Errors

Keep RPC and domain failures typed until the route or component that can act on them.

- `AccessApi.AuthenticationRequired` redirects to `/anmelden`.
- A successful account with no contexts redirects to `/aktivieren`.
- Transport, decoding, rate-limit, and server failures reach a route error boundary.
- Components map known domain failures to German messages at the presentation boundary.
- Delete the custom `ApiResult` transport type and the marketing `boolean` failure conversion.

### Reactivity and freshness

Use named invalidation domains rather than tuple-shaped query keys:

```ts
const accessReactivity = {
  account: [] as const,
  reservation: (token: Organization.SchoolAccessReservationToken) => [token] as const,
};
```

AtomRpc payloads and `Atom.family` arguments define query identity. Reactivity keys only define which
queries a successful mutation refreshes. An array is a set of independent keys, not a composite
TanStack Query key.

Account freshness comes from:

- successful completion and profile mutations;
- successful Better Auth sign-in and sign-out actions;
- an explicit refresh after any action that changes authorization.

Do not add `Atom.refreshOnWindowFocus` to `accountAtom` in this pass. A focus-only Atom refresh can
discover an expired session without rerunning the Router guard, which would send the failure to the
error boundary instead of `/anmelden`. Add focus refresh later only if the same focus event also
invalidates the active Router matches.

Do not use `router.invalidate()` for ordinary query invalidation. Use Atom reactivity or
`registry.refresh`. Invalidate Router as well only when changed authorization must rerun guards.

### Mutations and preloading

Router `beforeLoad` runs during intent preload. It may read and redirect, but it must not perform a
mutation.

Access redemption remains a guarded post-mount action or becomes an explicit confirmation action.
It uses an AtomRpc mutation, but no loader may trigger it. This prevents link hover from consuming a
reservation.

Components derive pending state from the mutation atom. Event handlers may use `useAtomSet` with
`mode: "promiseExit"` when navigation depends on the result. Reset shared mutation state when a form
subscribes to its previous result and that result must not survive a remount.

### SSR boundary

Keep `_public` server-rendered. Add a pathless `_client` route with `ssr: false` and place these URLs
under it without changing their public paths:

- `/app/**`;
- `/anmelden` and `/registrieren`;
- `/aktivieren/**` and `/einrichten`;
- `/passwort-vergessen` and `/passwort-zuruecksetzen`;
- `/operator/setup`.

API routes stay outside both page branches. TanStack Start still renders the root document shell.
The root public-config loader may continue to run because it supplies deployment and observability
configuration, not application data.

Remove `serializationKey` from `accountAtom`. The client application has no Atom hydration or
persistence mechanism that consumes it.

## Work packets

Each packet should land as its own coherent change. The proof listed for a packet belongs in the
same change as the behavior.

### W1. Put Effect Atom in Router context

Depends on: nothing.

Work:

- Add a domain-free Router context type containing `atomRegistry`.
- Create the registry inside `getRouter()` with the chosen default idle TTL.
- Change the root route to `createRootRouteWithContext`.
- Supply the registry to React with `RegistryContext.Provider` instead of letting
  `RegistryProvider` create a second registry.
- Add the abortable `getAtomResult` bridge.
- Add one browser AtomRpc service over `@stu/api.Rpcs` and `browserRpcProtocol`.
- Keep feature atoms in their feature directories. The infrastructure module owns only the shared
  RPC runtime and protocol.

Proof:

- Two calls to `getRouter()` receive different registries.
- Router loaders and React hooks observe the same registry.
- Aborting a loader signal interrupts a pending `getAtomResult` wait.
- Existing public and API tests still pass.

### W2. Add the client-only route branch

Depends on: W1.

Work:

- Add the pathless `_client` layout with `ssr: false`.
- Move all authentication and product route files under that layout.
- Leave `_public.*` and `api/**` outside the client branch.
- Regenerate the route tree through the normal TanStack build path.
- Keep the root config loader and document shell unchanged.

Proof:

- Route generation preserves every existing URL.
- The landing page, Impressum, and Datenschutz render page content on the server.
- An `/app` server request does not execute `Access.GetAccount` or render product route content.
- API route identities and handlers are unchanged.
- The production web build passes.

### W3. Move the account and context guard into Router

Depends on: W1 and W2.

Work:

- Rebuild `accountAtom` from the shared AtomRpc service.
- Give it the `account` reactivity domain.
- Add a `requireAccount` route helper that awaits the atom and redirects only on
  `AuthenticationRequired`.
- In the `/app` parent `beforeLoad`, redirect a successful account with no contexts to
  `/aktivieren`.
- Validate explicit `$school/$rolle` parameters against the loaded account. An invalid explicit
  context redirects to `/app`; it must not silently render a different context.
- Let `/app` choose the remembered context or the first valid context and redirect before render.
- Keep remembered-context persistence as external synchronization.
- Make the app shell read `accountAtom` through `useAtomSuspense` and derive context from URL plus
  account data.

Proof:

- An unauthenticated failure redirects to `/anmelden` before the app shell renders.
- Network and server failures render the route error boundary instead of redirecting to login.
- An account without contexts redirects to `/aktivieren`.
- `/app` redirects to the remembered valid context, then falls back to the first context.
- An invalid explicit school or role never renders another context under the invalid URL.
- Preloading and navigation share one account request.

### W4. Move route reads and redirects out of effects

Depends on: W1 through W3.

Work:

- Add `reservationAtom(token)` from the shared AtomRpc service.
- Decode reservation search parameters as `Organization.SchoolAccessReservationToken` in the
  registration and activation routes. Do not pass a plain string through the feature and decode it
  again at the RPC call.
- Let the registration route await `reservationAtom(token)` in its loader and render it with
  `useAtomSuspense` or an explicit failure result.
- Give the registration route a local error component that maps expected reservation and admission
  failures to the existing user-facing messages. Unknown transport failures use the shared route
  error state.
- Remove the registration request state machine and manual cancellation flag.
- Replace the operator and school-role index redirect effects with `beforeLoad` redirects.
- Keep redirects pure and safe during intent preload.

Proof:

- Changing the reservation token selects a distinct atom and request.
- Navigation away aborts a pending reservation wait.
- A failed reservation shows its typed user-facing state.
- Index routes never render an empty frame before redirecting.
- No route `useEffect` performs a read or redirect.

### W5. Move first-party mutations to AtomRpc

Depends on: W1 and W3. W4 should land first to keep access flows easy to review.

Work:

- Replace direct Promise RPC calls for reserve access, complete reservation, save profile, and
  marketing enquiry submission.
- Decode form input with Effect Schema before invoking each mutation.
- Derive pending and failure UI from `AsyncResult`.
- Make successful completion and profile mutations invalidate `account`.
- Invalidate the matching reservation after completion.
- Add one authorization-refresh action that refreshes `accountAtom` and invalidates Router. Use it
  after successful Better Auth email or passkey sign-in and sign-out. Passkey list changes remain in
  Better Auth's own store and do not refresh the account atom.
- Rerun Router guards after authorization changes, not after ordinary data mutations.
- Keep automatic reservation redemption outside Router preload lifecycle.
- Delete the feature-level `RpcClient.make`, `Effect.runPromise`, `ApiResult`, and boolean failure
  adapters once their last callers move.

Proof:

- A successful access mutation refreshes a mounted account query once.
- A failed mutation does not invalidate queries.
- Typed domain failures still select the existing German messages.
- Double render and intent preload do not redeem access twice.
- `apps/web/src/features` contains no direct first-party `RpcClient.make` call.

### W6. Finish the focused web effect cleanup

Depends on: W4. The individual changes are otherwise independent.

Work:

- Replace the two media-query effects with one `useSyncExternalStore` helper.
- Hoist the site-header section ID array so the observer does not restart after every render.
- Replace the decorative weekday effect with the static `Heute` label. The preview does not need a
  live calendar.
- Add cancellation to the dynamic Sentry import so unmounted bootstrap code cannot initialize it.
- Keep pointer subscriptions, observers, observability lifecycle, remembered-context storage, and
  access redemption effects because they synchronize with external systems.

Proof:

- Motion and pointer preferences update when their media queries change.
- The server snapshot for both media queries remains stable during hydration.
- Header rerenders do not recreate the IntersectionObserver.
- Unmounting observability bootstrap before import completion does not initialize Sentry.
- A final effect inventory documents why every remaining web effect exists.

### W7. Repair telemetry startup independently

Depends on: nothing. It may run in parallel with W1 through W6 in a separate workspace.

Work:

- Recover only the initial `TelemetryStorage.read` failure as an empty in-memory snapshot.
- Emit one bounded warning that identifies storage degradation without including stored contents or
  user data.
- Keep initial normalization writes and all later write failures typed and observable.
- Add an initial-read-failure test that proves enqueue, stats, and a later successful write still
  work.
- Replace `Math.random()` telemetry IDs with bytes from `expo-crypto`. Add it through Expo's package
  installer so its version matches the SDK.

Proof:

- A rejected first read does not prevent service acquisition.
- Later storage write failures still fail with `TelemetryStorageError`.
- The degradation warning occurs once per outbox acquisition.
- Mobile telemetry IDs contain the required byte lengths and no `Math.random()` call remains.
- This packet does not change mobile atoms, fixtures, routes, or domain types.

### W8. Remove stale setup guidance and dependencies

Depends on: W5 and W6 so documentation describes the final design.

Work:

- Rewrite `apps/web/README.md` as project guidance. Remove scaffold examples that recommend
  TanStack Query or fetch route data from `useEffect`.
- Extend `docs/effect-architecture.md` with Router and Atom ownership, invalidation keys, and the
  distinction between idle TTL and freshness.
- Update `docs/authentication.md` with account refresh and Router guard behavior.
- Remove unused `@tanstack/react-form`, `@tanstack/react-table`, and the direct
  `@tanstack/router-plugin` dependency after one final import check.
- Pin the retained TanStack packages to their currently verified compatible versions, preferably in
  the workspace catalog so updates are deliberate and reviewed together.
- Regenerate `pnpm-lock.yaml` and `pnpm-lock.web.yaml` with the repository commands.
- Replace the copied Effect language-service severity list with upstream defaults. Keep the lint
  presets as the build authority and retain only intentional local overrides.

Proof:

- The README has no generic starter sections, demo references, TanStack Query recommendation, or
  data-fetching `useEffect` example.
- No removed package is imported or required by the Start Vite plugin.
- `just web-lock-check` passes.
- Editor Effect diagnostics use the locked plugin defaults while lint still enables all selected
  presets as errors.

### W9. Final integration proof

Depends on: W1 through W8.

Add or retain focused tests for:

- registry isolation between Router instances;
- loader cancellation;
- preload deduplication;
- authentication redirect versus transport failure;
- remembered and invalid explicit context routing;
- reservation query identity;
- successful mutation invalidation;
- failed mutation non-invalidation;
- selective SSR route ownership;
- telemetry initial-read recovery.

Run:

```bash
just fmt
just qa
vp run --filter @stu/web build
```

Inspect the production build warnings. React Compiler warnings are acceptable only when they match
the previously understood dynamic-import limitations and no new warning appears in changed code.

## Dependency graph

```text
W1 Registry and AtomRpc runtime
 |
 +--> W2 Client-only route branch
       |
       +--> W3 Account and context guards
             |
             +--> W4 Route reads and redirects
             |     |
             |     +--> W6 Web effect cleanup
             |
             +--> W5 First-party mutations
                         |
                         +--> W8 Docs and dependency cleanup

W7 Telemetry repair ------------------------> W9 Final integration proof
W1 through W8 ------------------------------> W9 Final integration proof
```

W7 has no file overlap with the web packets except the root lockfile if it adds `expo-crypto`.
Regenerate and resolve lockfiles only once when parallel work rejoins.

## Completion criteria

The project is done when all of these statements are true:

- Effect Atom is the only first-party web application query cache.
- One per-router registry is shared by loaders and React.
- One AtomRpc service owns the browser RPC runtime and reactivity graph.
- Route reads and redirects do not use `useEffect`.
- Authentication failures are distinct from transport and server failures.
- First-party mutations preserve typed errors and invalidate named Atom domains.
- Intent preloading cannot execute a mutation.
- Product and authentication routes opt out of SSR through one inherited boundary.
- Landing and legal page content still server-render.
- Better Auth remains the owner of session, passkey, and WebAuthn protocol state.
- Mobile remains fixture-backed and no persistence or sync architecture enters this work.
- Every remaining web effect has a concrete external system to synchronize with.
- Route, Atom, SSR, telemetry, package, and build checks pass.

## Deferred work

Revisit mobile only as a separate, deliberately funded project. Its first production-data slice
should still be one domain end to end, probably tasks, with core schemas, local persistence,
reactive projections, and synchronization designed together. Do not introduce remote query atoms as
a temporary mobile source of truth while this plan is being executed.

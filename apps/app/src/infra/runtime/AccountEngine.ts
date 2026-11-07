import { Studienbuch } from "@stu/core";
import { CryptoSuite } from "@stu/e2ee";
import { type Ports, SyncClient, WebSocketTransport } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";

import { AuthApi } from "../auth/AuthApi.ts";
import { SessionStore } from "../auth/SessionStore.ts";
import { Layers } from "./Layers.ts";

// The sync engine of the account signed in on a device, on that account's database, secrets and
// session. The app runs one for its own device; the Sync Lab runs one per virtual device, with its
// faults on the transport and the lifecycle.

export * as AccountEngine from "./AccountEngine.ts";

/**
 * The engine for `accountId` over `transport`, on the device's layers. Lifecycle, CryptoSuite and
 * Reactivity come from the caller, so the Lab can steer them.
 */
export const layer = (
  accountId: string,
  transport: Layer.Layer<
    Ports.Transport,
    never,
    Layer.Services<typeof WebSocketTransport.layer>
  > = WebSocketTransport.layer,
) =>
  SyncClient.layer(Studienbuch.schema).pipe(
    Layer.provideMerge(transport),
    Layer.provideMerge(SessionStore.session(accountId)),
    Layer.provideMerge(Layers.account(accountId)),
  );

const forApp = (accountId: string) =>
  layer(accountId).pipe(
    Layer.provideMerge(Layer.mergeAll(CryptoSuite.layer, Layer.fresh(Reactivity.layer))),
  );

/**
 * The scope of the account's running engine. Work that belongs to the account, such as publishing
 * its keys, forks into it, so sign-out stops it with the engine.
 */
export class EngineScope extends Context.Service<EngineScope, Scope.Scope>()(
  "AccountEngine.EngineScope",
) {}

type Running = Layer.Success<ReturnType<typeof forApp>> | EngineScope;

type Failure = Layer.Error<ReturnType<typeof forApp>>;

/**
 * The device's running engines. An account's engine starts at its first use and runs until
 * sign-out closes it, because its database may be open only once, and only a closed one can be
 * deleted.
 */
export class Engines extends Context.Service<
  Engines,
  {
    readonly context: (accountId: string) => Effect.Effect<Context.Context<Running>, Failure>;
    /** Stops the account's engine and waits until its database is closed. */
    readonly close: (accountId: string) => Effect.Effect<void>;
  }
>()("AccountEngine.Engines") {}

/** `Engines` on the device's layers, one per device. */
export const engines = Layer.effect(Engines)(
  Effect.gen(function* () {
    const device = yield* Effect.context<Layer.Services<ReturnType<typeof forApp>>>();

    const running = new Map<
      string,
      { readonly scope: Scope.Closeable; readonly context: Context.Context<Running> }
    >();

    const turns = yield* Semaphore.make(1);

    const close = (accountId: string) =>
      turns.withPermit(
        Effect.suspend(() => {
          const known = running.get(accountId);
          running.delete(accountId);

          return known === undefined ? Effect.void : Scope.close(known.scope, Exit.void);
        }),
      );

    yield* Effect.addFinalizer(() => Effect.forEach([...running.keys()], close, { discard: true }));

    return Engines.of({
      context: (accountId) =>
        turns.withPermit(
          Effect.gen(function* () {
            const known = running.get(accountId);

            if (known !== undefined) return known.context;
            const scope = yield* Scope.make();

            const built = yield* Layer.buildWithScope(forApp(accountId), scope).pipe(
              Effect.provide(device),
              Effect.onError(() => Scope.close(scope, Exit.void)),
            );

            const context = Context.add(built, EngineScope, scope);

            running.set(accountId, { scope, context });

            return context;
          }),
        ),
      close,
    });
  }),
).pipe(Layer.provide(AuthApi.layer));

/** The device's own layers with its engines, one value, so every atom runtime shares one build. */
export const device = Layer.mergeAll(engines, AuthApi.layer).pipe(
  Layer.provideMerge(SessionStore.layer),
  Layer.provideMerge(Layers.app),
);

/** This device's running engine for `accountId`, for an atom runtime, with the device under it. */
export const app = (accountId: string) =>
  Layer.effectContext(Effect.flatMap(Engines, (each) => each.context(accountId))).pipe(
    Layer.provideMerge(device),
  );

/** Stops the account's engine before its data goes, as at sign-out. */
export const close = (accountId: string) =>
  Effect.flatMap(Engines, (each) => each.close(accountId));

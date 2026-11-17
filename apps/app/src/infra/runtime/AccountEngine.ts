import { Studienbuch } from "@stu/core";
import { CryptoSuite } from "@stu/e2ee";
import { type Ports, SyncClient, WebSocketTransport } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Schema from "effect/Schema";
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
 * The engine for `accountId` over `transport`, on the device's layers, with its data in memory on
 * a public computer. Lifecycle, CryptoSuite and Reactivity come from the caller, so the Lab can
 * steer them.
 */
export const layer = (
  accountId: string,
  publicComputer: boolean,
  transport: Layer.Layer<
    Ports.Transport,
    never,
    Layer.Services<typeof WebSocketTransport.layer>
  > = WebSocketTransport.layer,
) =>
  SyncClient.layer(Studienbuch.schema).pipe(
    Layer.provideMerge(transport),
    Layer.provideMerge(SessionStore.session(accountId)),
    Layer.provideMerge(Layers.account(accountId, publicComputer)),
  );

const forApp = (accountId: string, publicComputer: boolean) =>
  layer(accountId, publicComputer).pipe(
    Layer.provideMerge(Layer.mergeAll(CryptoSuite.layer, Layer.fresh(Reactivity.layer))),
  );

/**
 * The scope of the account's running engine. Work that belongs to the account, such as publishing
 * its keys, forks into it, so sign-out stops it with the engine.
 */
export class EngineScope extends Context.Service<EngineScope, Scope.Scope>()(
  "AccountEngine.EngineScope",
) {}

/**
 * Runs `effect` in the engine's scope and waits for it. A screen that unmounts meanwhile stops
 * waiting but not the effect, and sign-out, which closes the engine, still ends it.
 */
export const inEngineScope = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(EngineScope, (scope) => Effect.flatMap(Effect.forkIn(effect, scope), Fiber.join));

type Running = Layer.Success<ReturnType<typeof forApp>> | EngineScope;

type Failure = Layer.Error<ReturnType<typeof forApp>>;

/** The device holds no session of the account, as once it signed out, so its engine stays off. */
export class SignedOut extends Schema.TaggedError<SignedOut, { readonly brand: unique symbol }>()(
  "AccountEngine.SignedOut",
  { accountId: Schema.String },
) {}

/** More of the account's commands wait for the server than the sign-out's question counted. */
export class MoreUnsent extends Schema.TaggedError<MoreUnsent, { readonly brand: unique symbol }>()(
  "AccountEngine.MoreUnsent",
  { waiting: Schema.Int },
) {}

/**
 * The device's running engines. An account's engine starts at its first use and runs until
 * sign-out stops it, because its database may be open only once, and only a closed one can be
 * deleted. It keeps its data where the account's session chose at sign-in.
 */
export class Engines extends Context.Service<
  Engines,
  {
    /** The account's engine, while the device holds its session. */
    readonly context: (
      accountId: string,
    ) => Effect.Effect<Context.Context<Running>, Failure | SignedOut>;
    /**
     * Signs the account out in one turn: refuses when more commands wait than `unsent` counted
     * (`None` takes any number), else stops its engine and runs `erase`, which deletes what the
     * account kept and ends with its session. No engine of the account starts in between.
     */
    readonly forget: <E, R>(
      accountId: string,
      unsent: Option.Option<number>,
      erase: Effect.Effect<void, E, R>,
    ) => Effect.Effect<void, E | MoreUnsent, R>;
  }
>()("AccountEngine.Engines") {}

/** `Engines` on the device's layers, one per device. */
export const engines = Layer.effect(Engines)(
  Effect.gen(function* () {
    const device = yield* Effect.context<Layer.Services<ReturnType<typeof forApp>>>();
    const sessions = yield* SessionStore.Service;

    const running = new Map<
      string,
      { readonly scope: Scope.Closeable; readonly context: Context.Context<Running> }
    >();

    // One turn at a time: an engine starts, or an account signs out.
    const turns = yield* Semaphore.make(1);

    const stop = (accountId: string) =>
      Effect.suspend(() => {
        const known = running.get(accountId);
        running.delete(accountId);

        return known === undefined ? Effect.void : Scope.close(known.scope, Exit.void);
      });

    yield* Effect.addFinalizer(() =>
      turns.withPermit(Effect.forEach([...running.keys()], stop, { discard: true })),
    );

    return Engines.of({
      context: (accountId) =>
        turns.withPermit(
          Effect.gen(function* () {
            const session = Option.filter(
              yield* sessions.current,
              (signed) => signed.accountId === accountId,
            );

            if (Option.isNone(session)) return yield* new SignedOut({ accountId });
            const known = running.get(accountId);

            if (known !== undefined) return known.context;
            const scope = yield* Scope.make();

            const built = yield* Layer.buildWithScope(
              forApp(accountId, session.value.publicComputer),
              scope,
            ).pipe(
              Effect.provide(device),
              Effect.onError(() => Scope.close(scope, Exit.void)),
            );

            const context = Context.add(built, EngineScope, scope);

            running.set(accountId, { scope, context });

            return context;
          }),
        ),
      forget: (accountId, unsent, erase) =>
        turns.withPermit(
          Effect.gen(function* () {
            const known = running.get(accountId);

            if (known !== undefined && Option.isSome(unsent)) {
              const { waiting } = yield* Context.get(known.context, SyncClient.Service).status.get;

              if (waiting > unsent.value) return yield* new MoreUnsent({ waiting });
            }

            yield* stop(accountId);
            yield* erase;
          }),
        ),
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

/** `Engines.forget` on this device. */
export const forget = <E, R>(
  accountId: string,
  unsent: Option.Option<number>,
  erase: Effect.Effect<void, E, R>,
) => Effect.flatMap(Engines, (each) => each.forget(accountId, unsent, erase));

import { Studienbuch } from "@stu/core";
import { CryptoSuite } from "@stu/e2ee";
import { type Outbox, Ports, SyncClient, WebSocketTransport } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as SqlClient from "effect/sql/SqlClient";
import type * as SqlError from "effect/sql/SqlError";

import { AuthApi } from "../auth/AuthApi.ts";
import { SessionStore } from "../auth/SessionStore.ts";
import type { Keychain } from "../keychain/Keychain.ts";
import { Forgetting } from "./Forgetting.ts";
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

/** A command the sign-out's question didn't show waits for the server, the newest one here. */
export class MoreUnsent extends Schema.TaggedError<MoreUnsent, { readonly brand: unique symbol }>()(
  "AccountEngine.MoreUnsent",
  { newest: Schema.Int },
) {}

/**
 * The device's running engines. An account's engine starts at its first use and runs until
 * sign-out stops it, because its database may be open only once, and only a closed one can be
 * deleted. It keeps its data where the account's session chose at sign-in.
 */
export class Engines extends Context.Service<
  Engines,
  {
    /** The account's engine, while the device holds its session and hasn't begun to forget it. */
    readonly context: (
      accountId: string,
    ) => Effect.Effect<Context.Context<Running>, Failure | SignedOut>;
    /**
     * Signs the account out in one turn. `unsent` is the newest unsent command's mutation id that
     * the question before showed, 0 when none waited, `None` when it couldn't tell. A newer one
     * waiting refuses; otherwise the engine stops and `erase` deletes what the account kept and
     * ends with its session. No write and no engine of the account starts in between.
     */
    readonly forget: <E, R>(
      accountId: string,
      unsent: Option.Option<number>,
      erase: Effect.Effect<void, E, R>,
    ) => Effect.Effect<void, E | MoreUnsent | SqlError.SqlError, R>;
    /**
     * Keeps a new session (`Forgetting.Service`): `session` runs in a turn of its own, after the
     * sign-outs the device left unfinished, so no sign-out deletes what it stores.
     */
    readonly keep: <A, E, R>(
      session: Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E | Forgetting.Unfinished | Keychain.Unavailable, R>;
  }
>()("AccountEngine.Engines") {}

/**
 * The mutation id of the newest of `commands`, oldest first as `SyncClient.pending` reads them, 0
 * for none. Ids only grow on a device, so a command newer than what the question showed has a
 * higher one, also when older ones were sent meanwhile.
 */
export const newest = (commands: ReadonlyArray<Outbox.Command>) => commands.at(-1)?.mutationId ?? 0;

const newestUnsent = Effect.map(SyncClient.pending.run(), newest);

/** `Engines` on the device's layers, one per device. */
export const engines = Layer.effect(Engines)(
  Effect.gen(function* () {
    const device = yield* Effect.context<Layer.Services<ReturnType<typeof forApp>>>();
    const leftovers = yield* Effect.context<Effect.Services<typeof Layers.finishSignOuts>>();
    const sessions = yield* SessionStore.Service;

    const running = new Map<
      string,
      {
        readonly scope: Scope.Closeable;
        readonly context: Context.Context<Running>;
        /** Held by each write of the account's rows or secrets, and by sign-out until it stops. */
        readonly writes: Semaphore.Semaphore;
        readonly stopped: Ref.Ref<boolean>;
      }
    >();

    // One turn at a time: an engine starts, an account signs out, or a new session is kept.
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

            if ((yield* Effect.provide(Forgetting.pending, device)).includes(accountId)) {
              return yield* new SignedOut({ accountId });
            }

            const scope = yield* Scope.make();

            const built = yield* Layer.buildWithScope(
              forApp(accountId, session.value.publicComputer),
              scope,
            ).pipe(
              Effect.provide(device),
              Effect.onError(() => Scope.close(scope, Exit.void)),
            );

            const writes = yield* Semaphore.make(1);
            const stopped = yield* Ref.make(false);
            const sync = Context.get(built, SyncClient.Service);
            const secrets = Context.get(built, Ports.DeviceSecrets);

            // A write after sign-out stopped the engine would land in a closed database, or keep a
            // secret the erase already deleted.
            const gated = <A, E>(write: Effect.Effect<A, E>) =>
              writes.withPermit(
                Effect.flatMap(Ref.get(stopped), (done) =>
                  done ? Effect.die(new SignedOut({ accountId })) : write,
                ),
              );

            const context = built.pipe(
              Context.add(
                SyncClient.Service,
                SyncClient.Service.of({
                  ...sync,
                  mutate: (mutator, args) => gated(sync.mutate(mutator, args)),
                  redo: (rejected) => gated(sync.redo(rejected)),
                  unlock: (keys) => gated(sync.unlock(keys)),
                }),
              ),
              Context.add(
                Ports.DeviceSecrets,
                Ports.DeviceSecrets.of({
                  ...secrets,
                  set: (name, value) => gated(secrets.set(name, value)),
                  remove: (name) => gated(secrets.remove(name)),
                }),
              ),
              Context.add(EngineScope, scope),
            );

            running.set(accountId, { scope, context, writes, stopped });

            return context;
          }),
        ),
      forget: (accountId, unsent, erase) =>
        turns.withPermit(
          Effect.gen(function* () {
            const known = running.get(accountId);

            // A write under way finishes first, and none starts after, so the outbox read here is
            // what sign-out deletes.
            if (known !== undefined) {
              yield* known.writes.withPermit(
                Effect.gen(function* () {
                  if (Option.isSome(unsent)) {
                    const newest = yield* newestUnsent.pipe(
                      Effect.provideService(
                        SqlClient.SqlClient,
                        Context.get(known.context, SqlClient.SqlClient),
                      ),
                    );

                    if (newest > unsent.value) return yield* new MoreUnsent({ newest });
                  }

                  yield* Ref.set(known.stopped, true);
                }),
              );
            }

            yield* Effect.uninterruptible(Effect.andThen(stop(accountId), erase));
          }),
        ),
      keep: (session) =>
        turns.withPermit(Effect.andThen(Effect.provide(Layers.finishSignOuts, leftovers), session)),
    });
  }),
).pipe(Layer.provide(AuthApi.layer));

/** `Forgetting.Service` on this device's engines (`Engines.keep`). */
const keeping = Layer.effect(Forgetting.Service)(
  Effect.map(Engines, (each) => Forgetting.Service.of({ keep: each.keep })),
);

/** The device's own layers with its engines, one value, so every atom runtime shares one build. */
export const device = Layer.mergeAll(keeping.pipe(Layer.provideMerge(engines)), AuthApi.layer).pipe(
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

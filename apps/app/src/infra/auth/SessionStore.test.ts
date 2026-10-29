import { assert, describe, it } from "@effect/vitest";
import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";

import { Device } from "../device/Device.ts";
import { DeviceSessions } from "../keychain/DeviceSessions.ts";
import { MemoryKeychain } from "../keychain/MemoryKeychain.ts";
import { AuthApiTesting } from "./AuthApiTesting.ts";
import { SessionStore } from "./SessionStore.ts";

const lena = { accountId: "lena", token: Redacted.make("token-1") };

const device = Layer.mergeAll(
  Device.layer({ name: "phone", publicComputer: false }),
  Layer.succeed(Ports.Server)({ origin: new URL("https://one.example") }),
);

/** A fresh store over the same keychain, as after a restart of the app. */
const restarted = <A, E>(effect: Effect.Effect<A, E, SessionStore.Service>) =>
  Effect.provide(
    effect,
    SessionStore.layer.pipe(Layer.provide(DeviceSessions.layer), Layer.provide(device)),
  );

const tokenOf = (signed: Option.Option<SessionStore.Signed>) =>
  Option.map(
    Option.flatMap(signed, (found) => found.token),
    Redacted.value,
  );

describe("SessionStore", () => {
  it.effect("keeps the account across restarts, and forgets it at sign-out", () =>
    Effect.gen(function* () {
      yield* restarted(Effect.flatMap(SessionStore.Service, (store) => store.signedIn(lena)));

      const afterRestart = yield* restarted(
        Effect.flatMap(SessionStore.Service, (store) => store.current),
      );

      assert.deepStrictEqual(tokenOf(afterRestart), Option.some("token-1"));

      yield* restarted(Effect.flatMap(SessionStore.Service, (store) => store.forget));

      assert.isTrue(
        Option.isNone(
          yield* restarted(Effect.flatMap(SessionStore.Service, (store) => store.current)),
        ),
      );
    }).pipe(Effect.provide(MemoryKeychain.layer())),
  );

  it.effect("ends the engine's session when the server forgot it while the app was away", () =>
    Effect.gen(function* () {
      const lifecycle = yield* Queue.unbounded<Ports.LifecycleState>();

      const session = SessionStore.session("lena").pipe(
        Layer.provide(
          AuthApiTesting.layer({
            session: (token) =>
              Effect.succeed(
                Redacted.value(token) === "token-1" ? Option.none() : Option.some(new Date(0)),
              ),
          }),
        ),
        Layer.provide(Layer.succeed(Ports.Lifecycle)({ changes: Stream.fromQueue(lifecycle) })),
      );

      yield* Effect.gen(function* () {
        const store = yield* SessionStore.Service;

        yield* store.signedIn(lena);

        const engine = yield* Ports.Session;
        const tokens = yield* Stream.toQueue(engine.changes, { capacity: "unbounded" });

        assert.deepStrictEqual(
          Option.map(yield* Queue.take(tokens), Redacted.value),
          Option.some("token-1"),
        );

        yield* Queue.offer(lifecycle, { foreground: true, online: true });

        assert.isTrue(Option.isNone(yield* Queue.take(tokens)));
        assert.strictEqual(engine.accountId, "lena");
        assert.deepStrictEqual(
          Option.map(yield* store.current, (signed) => signed.accountId),
          Option.some("lena"),
        );
      }).pipe(
        Effect.provide(
          session.pipe(
            Layer.provideMerge(SessionStore.layer),
            Layer.provide(DeviceSessions.layer),
            Layer.provide(device),
          ),
        ),
        Effect.scoped,
      );
    }).pipe(Effect.provide(MemoryKeychain.layer())),
  );
});

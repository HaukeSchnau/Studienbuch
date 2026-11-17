import { assert, it } from "@effect/vitest";
import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";

import { Device } from "../device/Device.ts";
import { Names } from "../device/Names.ts";
import { DeviceSessions } from "../keychain/DeviceSessions.ts";
import { Keychain } from "../keychain/Keychain.ts";
import { MemoryKeychain } from "../keychain/MemoryKeychain.ts";
import { Forgetting } from "./Forgetting.ts";

const origin = new URL("https://one.example");

const device = Layer.mergeAll(
  Device.layer({ name: "ipad" }),
  Layer.succeed(Ports.Server)({ origin }),
);

const platform = DeviceSessions.layer.pipe(
  Layer.provideMerge(MemoryKeychain.layer()),
  Layer.provideMerge(device),
);

/** A keychain whose next `failures` removals of a secret fail, as a locked one does. */
const flaky = (failures: number) =>
  DeviceSessions.layer.pipe(
    Layer.provideMerge(
      Layer.effect(Keychain.Store)(
        Effect.gen(function* () {
          const memory = yield* Effect.provide(Keychain.Store, MemoryKeychain.layer());
          const left = yield* Ref.make(failures);

          return Keychain.Store.of({
            ...memory,
            remove: (name) =>
              Effect.flatMap(
                name.startsWith("secret.")
                  ? Ref.getAndUpdate(left, (n) => n - 1)
                  : Effect.succeed(0),
                (n) =>
                  n > 0
                    ? Effect.fail(
                        new Keychain.Unavailable({ operation: "remove", cause: "locked" }),
                      )
                    : memory.remove(name),
              ),
          });
        }),
      ),
    ),
    Layer.provideMerge(device),
  );

/** Runs `effect` while the test clock passes every retry's wait. */
const withRetries = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(effect);

    yield* TestClock.adjust("1 minute");

    return yield* Fiber.await(fiber);
  });

const rootKeyOf = (accountId: string) =>
  Effect.provide(
    Effect.map(Ports.DeviceSecrets, (secrets) => secrets),
    Keychain.secrets(Names.secrets(origin, "ipad", accountId)),
  );

const signIn = Effect.fn("Test.signIn")(function* (accountId: string) {
  const secrets = yield* rootKeyOf(accountId);
  const sessions = yield* DeviceSessions.Service;

  yield* secrets.set("root-key", new Uint8Array([accountId.length]));
  yield* secrets.set("pending-key", new Uint8Array([accountId.length]));
  yield* sessions.set({ accountId, token: Redacted.make(`token-${accountId}`), demo: false });
});

const what = Effect.fn("Test.what")(function* (accountId: string) {
  const secrets = yield* rootKeyOf(accountId);
  const sessions = yield* DeviceSessions.Service;

  return {
    rootKey: Option.isSome(yield* secrets.get("root-key")),
    pendingKey: Option.isSome(yield* secrets.get("pending-key")),
    session: (yield* sessions.all).some((session) => session.accountId === accountId),
  };
});

class Crash extends Schema.TaggedError<Crash, { readonly brand: unique symbol }>()(
  "Test.Crash",
  {},
) {}

// Lena and Tom share an iPad. Tom signing out must leave Lena signed in, keys and all.
it.effect("signing one account out leaves the other's secrets and session alone", () =>
  Effect.gen(function* () {
    const removed: Array<string> = [];

    yield* signIn("lena");
    yield* signIn("tom");
    yield* Forgetting.forget(
      "tom",
      (accountId) => Effect.sync(() => void removed.push(accountId)),
      Effect.void,
    );

    assert.deepStrictEqual(removed, ["tom"]);
    assert.deepStrictEqual(yield* what("tom"), {
      rootKey: false,
      pendingKey: false,
      session: false,
    });
    assert.deepStrictEqual(yield* what("lena"), { rootKey: true, pendingKey: true, session: true });
  }).pipe(Effect.provide(platform)),
);

it.effect("a sign-out that stopped halfway finishes at the next start", () =>
  Effect.gen(function* () {
    yield* signIn("tom");

    const stopped = yield* Effect.exit(
      Forgetting.forget("tom", () => Effect.die(new Crash()), Effect.void),
    );

    assert.isTrue(stopped._tag === "Failure");
    assert.deepStrictEqual(yield* what("tom"), { rootKey: true, pendingKey: true, session: true });

    const removed: Array<string> = [];

    yield* Forgetting.resume((accountId) => Effect.sync(() => void removed.push(accountId)));
    yield* Forgetting.resume((accountId) => Effect.sync(() => void removed.push(accountId)));

    assert.deepStrictEqual(removed, ["tom"]);
    assert.deepStrictEqual(yield* what("tom"), {
      rootKey: false,
      pendingKey: false,
      session: false,
    });
  }).pipe(Effect.provide(platform)),
);

// iOS can refuse the keychain for a moment. Past the note, sign-out runs on until it's done.
it.effect("a sign-out retries a step that fails once, in the same run", () =>
  Effect.gen(function* () {
    yield* signIn("tom");

    const signedOut = yield* withRetries(Forgetting.forget("tom", () => Effect.void, Effect.void));

    assert.isTrue(Exit.isSuccess(signedOut));
    assert.deepStrictEqual(yield* Forgetting.pending, []);
    assert.deepStrictEqual(yield* what("tom"), {
      rootKey: false,
      pendingKey: false,
      session: false,
    });
  }).pipe(Effect.provide(flaky(1))),
);

// The keychain stays locked. The sign-out says so as a failure the student can retry, and its
// note stays, so the account's engine stays off until a later run finishes it.
it.effect("a sign-out that keeps failing past its note stays begun until it finishes", () =>
  Effect.gen(function* () {
    yield* signIn("tom");

    const signedOut = yield* withRetries(Forgetting.forget("tom", () => Effect.void, Effect.void));
    const failure = Exit.findErrorOption(signedOut);

    assert.deepStrictEqual(
      Option.map(failure, (error) => error._tag),
      Option.some("Forgetting.Unfinished"),
    );
    assert.deepStrictEqual(yield* Forgetting.pending, ["tom"]);

    const finished = yield* withRetries(Forgetting.finish(() => Effect.void));

    assert.isTrue(Exit.isSuccess(finished));
    assert.deepStrictEqual(yield* Forgetting.pending, []);
    assert.deepStrictEqual(yield* what("tom"), {
      rootKey: false,
      pendingKey: false,
      session: false,
    });
  }).pipe(Effect.provide(flaky(4))),
);

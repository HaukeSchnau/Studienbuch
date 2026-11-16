import { assert, describe, it } from "@effect/vitest";
import { AccountKey } from "@stu/e2ee";
import { TestCrypto } from "@stu/e2ee/testing";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as TestClock from "effect/testing/TestClock";

import { Devices } from "./fixture/Devices.ts";
import { Keyring } from "./Keyring.ts";
import { Ports } from "./Ports.ts";

const services = Layer.mergeAll(
  Devices.secrets,
  Devices.database("sqlite-node"),
  TestCrypto.layer("keyring"),
);

// A first device keeps its new root key as `pending-key` until the server took it. The engine
// must not seal with it before then, nor after the server refused it for another chain.
it.effect("the keyring opens with the root key only, never with a pending one", () =>
  Effect.gen(function* () {
    const secrets = yield* Ports.DeviceSecrets;
    yield* secrets.set("pending-key", new Uint8Array([...Devices.rootKey, ...Devices.rootKey]));
    const pending = yield* (yield* Keyring.make(Devices.actor)).account;
    yield* secrets.set("root-key", Devices.rootKey);
    const unlocked = yield* (yield* Keyring.make(Devices.actor)).account;

    assert.isTrue(Option.isNone(pending));
    assert.isTrue(Option.exists(unlocked, ({ keys, record }) => AccountKey.matches(keys, record)));
  }).pipe(Effect.provide(services)),
);

/**
 * A keychain holding the account's root key, whose first read of it after `arm` waits for
 * `release` with the key it read, and completes `reached` when it starts waiting: a start that
 * reads the key just before something replaces or removes it.
 */
const slowKeychain = Effect.gen(function* () {
  const stored = new Map<Ports.SecretName, Uint8Array>([["root-key", Devices.rootKey]]);
  const reached = yield* Deferred.make<void>();
  const released = yield* Deferred.make<void>();
  let armed = false;

  const secrets = Ports.DeviceSecrets.of({
    get: (name) =>
      Effect.suspend(() => {
        const read = Option.fromNullishOr(stored.get(name));

        if (!armed || name !== "root-key") return Effect.succeed(read);
        armed = false;

        return Effect.as(
          Effect.andThen(Deferred.succeed(reached, undefined), Deferred.await(released)),
          read,
        );
      }),
    set: (name, value) => Effect.sync(() => void stored.set(name, value)),
    remove: (name) => Effect.sync(() => void stored.delete(name)),
  });

  const keyring = yield* Effect.provideService(
    Keyring.make(Devices.actor),
    Ports.DeviceSecrets,
    secrets,
  );

  /**
   * Starts deriving the account's keys and holds the start after its read of the root key, runs
   * `meanwhile` until it ends or waits for the keyring, then lets the start go on.
   */
  const race = <E, R>(meanwhile: Effect.Effect<void, E, R>) =>
    Effect.gen(function* () {
      armed = true;
      const start = yield* Effect.forkChild(keyring.account);
      yield* Deferred.await(reached);
      const other = yield* Effect.forkChild(Effect.andThen(Effect.sleep("1 second"), meanwhile));
      yield* TestClock.adjust("1 second");
      yield* Deferred.succeed(released, undefined);
      yield* Fiber.join(start);
      yield* Fiber.join(other);
    });

  return { secrets, keyring, race };
});

describe("a start that derives the keys while they change", () => {
  it.effect("can't bring back the keys of an account the wipe removed", () =>
    Effect.gen(function* () {
      const { secrets, keyring, race } = yield* slowKeychain;

      yield* race(Effect.andThen(secrets.remove("root-key"), keyring.forget));

      assert.isTrue(Option.isNone(yield* keyring.account));
    }).pipe(Effect.provide(services)),
  );

  it.effect("doesn't replace the newer keys an unlock kept", () =>
    Effect.gen(function* () {
      const { keyring, race } = yield* slowKeychain;
      const renewed = new Uint8Array(32).fill(7);
      const keys = yield* AccountKey.derive(Redacted.make(renewed), Devices.actor, 1);

      yield* race(keyring.unlock(keys));
      const account = yield* keyring.account;

      assert.deepStrictEqual(
        Option.map(account, (each) => [
          each.keys.generation,
          [...Redacted.value(each.keys.rootKey)],
        ]),
        Option.some([1, [...renewed]]),
      );
    }).pipe(Effect.provide(services)),
  );
});

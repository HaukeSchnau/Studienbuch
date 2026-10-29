import { assert, it } from "@effect/vitest";
import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { Device } from "../device/Device.ts";
import { Names } from "../device/Names.ts";
import { DeviceSessions } from "../keychain/DeviceSessions.ts";
import { Keychain } from "../keychain/Keychain.ts";
import { MemoryKeychain } from "../keychain/MemoryKeychain.ts";
import { Forgetting } from "./Forgetting.ts";

const origin = new URL("https://one.example");

const device = Layer.mergeAll(
  Device.layer({ name: "ipad", publicComputer: false }),
  Layer.succeed(Ports.Server)({ origin }),
);

const platform = DeviceSessions.layer.pipe(
  Layer.provideMerge(MemoryKeychain.layer()),
  Layer.provideMerge(device),
);

const rootKeyOf = (accountId: string) =>
  Effect.provide(
    Effect.map(Ports.DeviceSecrets, (secrets) => secrets),
    Keychain.secrets(Names.secrets(origin, "ipad", accountId)),
  );

const signIn = Effect.fn("Test.signIn")(function* (accountId: string) {
  const secrets = yield* rootKeyOf(accountId);
  const sessions = yield* DeviceSessions.Service;

  yield* secrets.set("root-key", new Uint8Array([accountId.length]));
  yield* sessions.set(accountId, Redacted.make(`token-${accountId}`));
});

const what = Effect.fn("Test.what")(function* (accountId: string) {
  const secrets = yield* rootKeyOf(accountId);
  const sessions = yield* DeviceSessions.Service;

  return {
    rootKey: Option.isSome(yield* secrets.get("root-key")),
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
    yield* Forgetting.forget("tom", (accountId) => Effect.sync(() => void removed.push(accountId)));

    assert.deepStrictEqual(removed, ["tom"]);
    assert.deepStrictEqual(yield* what("tom"), { rootKey: false, session: false });
    assert.deepStrictEqual(yield* what("lena"), { rootKey: true, session: true });
  }).pipe(Effect.provide(platform)),
);

it.effect("a sign-out that stopped halfway finishes at the next start", () =>
  Effect.gen(function* () {
    yield* signIn("tom");

    const stopped = yield* Effect.exit(Forgetting.forget("tom", () => Effect.fail(new Crash())));

    assert.isTrue(stopped._tag === "Failure");
    assert.deepStrictEqual(yield* what("tom"), { rootKey: true, session: true });

    const removed: Array<string> = [];

    yield* Forgetting.resume((accountId) => Effect.sync(() => void removed.push(accountId)));
    yield* Forgetting.resume((accountId) => Effect.sync(() => void removed.push(accountId)));

    assert.deepStrictEqual(removed, ["tom"]);
    assert.deepStrictEqual(yield* what("tom"), { rootKey: false, session: false });
  }).pipe(Effect.provide(platform)),
);

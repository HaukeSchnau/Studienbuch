import { assert, it } from "@effect/vitest";
import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import { Device } from "../device/Device.ts";
import { DeviceSessions } from "./DeviceSessions.ts";
import { Keychain } from "./Keychain.ts";
import { MemoryKeychain } from "./MemoryKeychain.ts";

// A platform keychain answers later, not at once. Two writers in between would each write back
// what they read, and the second would drop the first one's session.
const slowKeychain = Layer.effect(Keychain.Store)(
  Effect.map(Keychain.Store, (store) => ({
    get: (name: string) => Effect.andThen(Effect.yieldNow, store.get(name)),
    set: (name: string, value: string) => Effect.andThen(Effect.yieldNow, store.set(name, value)),
    remove: (name: string) => Effect.andThen(Effect.yieldNow, store.remove(name)),
  })),
).pipe(Layer.provide(MemoryKeychain.layer()));

it.effect("keeps both sessions when two accounts sign in at once", () =>
  Effect.gen(function* () {
    const sessions = yield* DeviceSessions.Service;

    yield* Effect.all(
      [
        sessions.set("lena", Redacted.make("token-lena")),
        sessions.set("tom", Redacted.make("token-tom")),
      ],
      { concurrency: "unbounded" },
    );

    const accounts = (yield* sessions.all).map((session) => session.accountId);

    assert.deepStrictEqual([...accounts].sort(), ["lena", "tom"]);
  }).pipe(
    Effect.provide(
      DeviceSessions.layer.pipe(
        Layer.provide(slowKeychain),
        Layer.provide(Device.layer({ name: "phone", publicComputer: false })),
        Layer.provide(Layer.succeed(Ports.Server)({ origin: new URL("https://one.example") })),
      ),
    ),
  ),
);

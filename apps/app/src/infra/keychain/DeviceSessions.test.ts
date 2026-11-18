import { assert, it } from "@effect/vitest";
import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

import { Device } from "../device/Device.ts";
import { DeviceSessions } from "./DeviceSessions.ts";
import { Keychain } from "./Keychain.ts";
import { KeychainTesting } from "./KeychainTesting.ts";
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
        sessions.set({ accountId: "lena", token: Redacted.make("token-lena"), demo: false }),
        sessions.set({ accountId: "tom", token: Redacted.make("token-tom"), demo: false }),
      ],
      { concurrency: "unbounded" },
    );

    const accounts = (yield* sessions.all).map((session) => session.accountId);

    assert.deepStrictEqual([...accounts].sort(), ["lena", "tom"]);
  }).pipe(
    Effect.provide(
      DeviceSessions.layer.pipe(
        Layer.provide(slowKeychain),
        Layer.provide(Device.layer({ name: "phone" })),
        Layer.provide(Layer.succeed(Ports.Server)({ origin: new URL("https://one.example") })),
      ),
    ),
  ),
);

// A kept session takes the place of a sign-up's staged card, and a sign-out takes it too. A
// keychain that refuses mid-way leaves the card only where the next step finds it.
it.effect("drops a staged card with a kept or removed session, or at the next start", () =>
  Effect.gen(function* () {
    const { keychain, refuse } = yield* KeychainTesting.make;
    const lena = { accountId: "lena", token: Redacted.make("token-lena"), demo: false };

    yield* Effect.gen(function* () {
      const sessions = yield* DeviceSessions.Service;
      const staged = Effect.map(sessions.staged, Option.isSome);
      const code = Redacted.make(new Uint8Array(16).fill(3));

      yield* sessions.stage(code);
      const beforeSession = yield* staged;

      // The session is kept even when its card can't go.
      yield* refuse({ operation: "remove", name: "sign-up-card" });
      yield* sessions.set(lena);
      const besideSession = yield* staged;

      yield* refuse();
      yield* DeviceSessions.tidy;
      const afterStart = yield* staged;

      // A sign-out that can't take the card fails before the session goes, so its note stays.
      yield* sessions.stage(code);
      yield* refuse({ operation: "remove", name: "sign-up-card" });
      const refused = yield* Effect.flip(sessions.remove("lena"));
      const sessionsLeft = (yield* sessions.all).length;

      yield* refuse();
      yield* sessions.remove("lena");

      assert.deepStrictEqual(
        {
          beforeSession,
          besideSession,
          afterStart,
          refused: refused.operation,
          sessionsLeft,
          afterSignOut: yield* staged,
        },
        {
          beforeSession: true,
          besideSession: true,
          afterStart: false,
          refused: "remove",
          sessionsLeft: 1,
          afterSignOut: false,
        },
      );
    }).pipe(
      Effect.provide(
        DeviceSessions.layer.pipe(
          Layer.provide(keychain),
          Layer.provide(Device.layer({ name: "phone" })),
          Layer.provide(Layer.succeed(Ports.Server)({ origin: new URL("https://one.example") })),
        ),
      ),
    );
  }),
);

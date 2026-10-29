import { assert, it } from "@effect/vitest";
import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { Keychain } from "./Keychain.ts";
import { MemoryKeychain } from "./MemoryKeychain.ts";

// A new key for an existing database would lock its data away for good.
it.effect("creates a database's key once and reads it on every later start", () =>
  Effect.gen(function* () {
    const first = yield* Keychain.databaseKey("account-a");
    const later = yield* Keychain.databaseKey("account-a");
    const other = yield* Keychain.databaseKey("account-b");

    assert.match(first, /^[0-9a-f]{64}$/u);
    assert.strictEqual(later, first);
    assert.notStrictEqual(other, first);
  }).pipe(Effect.provide(MemoryKeychain.layer())),
);

it.effect("keeps a key that is already stored", () =>
  Effect.gen(function* () {
    assert.strictEqual(yield* Keychain.databaseKey("diagnostics"), "ab".repeat(32));
  }).pipe(Effect.provide(MemoryKeychain.layer([["database.diagnostics", "ab".repeat(32)]]))),
);

it.effect("a deleted database's next key is a new one", () =>
  Effect.gen(function* () {
    const before = yield* Keychain.databaseKey("account-a");

    yield* Keychain.forgetDatabaseKey("account-a");

    assert.notStrictEqual(yield* Keychain.databaseKey("account-a"), before);
  }).pipe(Effect.provide(MemoryKeychain.layer())),
);

const secretsOf = (namespace: string) =>
  Effect.provide(
    Ports.DeviceSecrets.useSync((secrets) => secrets),
    Keychain.secrets(namespace),
  );

it.effect("each device keeps its secrets apart, and sign-out's remove forgets them", () =>
  Effect.gen(function* () {
    const a = yield* secretsOf("device-a");
    const b = yield* secretsOf("device-b");
    const rootKey = new Uint8Array([0, 1, 254, 255]);

    yield* a.set("root-key", rootKey);

    assert.deepStrictEqual(yield* a.get("root-key"), Option.some(rootKey));
    assert.deepStrictEqual(yield* b.get("root-key"), Option.none());

    yield* a.remove("root-key");

    assert.deepStrictEqual(yield* a.get("root-key"), Option.none());
  }).pipe(Effect.provide(MemoryKeychain.layer())),
);

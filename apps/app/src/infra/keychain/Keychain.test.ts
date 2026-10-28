import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { Keychain } from "./Keychain.ts";

const inMemory = (entries: ReadonlyArray<readonly [string, string]>) => {
  const store = new Map(entries);

  return Layer.succeed(Keychain.Store)({
    get: (name) => Effect.sync(() => Option.fromNullishOr(store.get(name))),
    set: (name, value) => Effect.sync(() => void store.set(name, value)),
  });
};

// A new key for an existing database would lock its data away for good.
it.effect("creates the database key once and reads it on every later start", () =>
  Effect.gen(function* () {
    const first = yield* Keychain.databaseKey;
    const later = yield* Keychain.databaseKey;

    assert.match(first, /^[0-9a-f]{64}$/u);
    assert.strictEqual(later, first);
  }).pipe(Effect.provide(inMemory([]))),
);

it.effect("keeps a key that is already stored", () =>
  Effect.gen(function* () {
    assert.strictEqual(yield* Keychain.databaseKey, "ab".repeat(32));
  }).pipe(Effect.provide(inMemory([["database-key", "ab".repeat(32)]]))),
);

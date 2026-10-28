import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/** Secrets that never leave this device: the iOS keychain, Android's Keystore-backed storage. */
export class Store extends Context.Service<
  Store,
  {
    readonly get: (name: string) => Effect.Effect<Option.Option<string>, Unavailable>;
    readonly set: (name: string, value: string) => Effect.Effect<void, Unavailable>;
  }
>()("Keychain.Store") {}

export class Unavailable extends Schema.TaggedError<
  Unavailable,
  { readonly brand: unique symbol }
>()("Keychain.Unavailable", {
  operation: Schema.Literals(["get", "set"]),
  cause: Schema.Defect(),
}) {}

/** 32 random bytes as hex, the raw key SQLCipher takes as `x'…'`. */
const DatabaseKey = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/u));

const decodeDatabaseKey = Schema.decodeEffect(DatabaseKey);

const databaseKeyName = "database-key";

/**
 * The key of this device's database, created and stored on the first start. A stored key that no
 * longer parses is a defect: replacing it would lock the database for good.
 */
export const databaseKey = Effect.gen(function* () {
  const store = yield* Store;
  const stored = yield* store.get(databaseKeyName);

  if (Option.isSome(stored)) {
    return yield* decodeDatabaseKey(stored.value).pipe(Effect.orDie);
  }

  const key = Hex.encode(globalThis.crypto.getRandomValues(new Uint8Array(32)));
  yield* store.set(databaseKeyName, key);

  return key;
});

export * as Keychain from "./Keychain.ts";

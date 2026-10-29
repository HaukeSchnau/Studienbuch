import { Ports } from "@stu/sync/client";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Hex from "effect/encoding/Hex";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/**
 * Secrets that never leave this device, as text under a name: the iOS keychain and Android's
 * Keystore-backed storage, IndexedDB under a non-extractable key in a browser, or memory on a
 * public computer. Names use letters, digits, `.`, `-` and `_`, which every store accepts.
 */
export class Store extends Context.Service<
  Store,
  {
    readonly get: (name: string) => Effect.Effect<Option.Option<string>, Unavailable>;
    readonly set: (name: string, value: string) => Effect.Effect<void, Unavailable>;
    /** Removing a name that holds nothing succeeds. */
    readonly remove: (name: string) => Effect.Effect<void, Unavailable>;
  }
>()("Keychain.Store") {}

export class Unavailable extends Schema.TaggedError<
  Unavailable,
  { readonly brand: unique symbol }
>()("Keychain.Unavailable", {
  operation: Schema.Literals(["get", "set", "remove"]),
  cause: Schema.Defect(),
}) {}

/** 32 random bytes as hex, the raw key SQLCipher takes as `x'…'`. */
const DatabaseKey = Schema.String.check(Schema.isPattern(/^[0-9a-f]{64}$/u));

const decodeDatabaseKey = Schema.decodeEffect(DatabaseKey);

const databaseKeyName = (database: string) => `database.${database}`;

/**
 * The key of one database, created and stored when it opens the first time. A stored key that no
 * longer parses is a defect: replacing it would lock the database for good.
 */
export const databaseKey = Effect.fn("Keychain.databaseKey")(function* (database: string) {
  const store = yield* Store;
  const stored = yield* store.get(databaseKeyName(database));

  if (Option.isSome(stored)) {
    return yield* decodeDatabaseKey(stored.value).pipe(Effect.orDie);
  }

  const key = Hex.encode(globalThis.crypto.getRandomValues(new Uint8Array(32)));
  yield* store.set(databaseKeyName(database), key);

  return key;
});

/** Forgets a deleted database's key. */
export const forgetDatabaseKey = Effect.fn("Keychain.forgetDatabaseKey")(function* (
  database: string,
) {
  const store = yield* Store;

  yield* store.remove(databaseKeyName(database));
});

const decodeSecret = Schema.decodeEffect(Schema.Uint8ArrayFromBase64);

/**
 * The engine's `DeviceSecrets` on this store, in a namespace of their own (`Names.secrets`), so
 * every server and virtual device keeps its secrets apart.
 */
export const secrets = (namespace: string) =>
  Layer.effect(Ports.DeviceSecrets)(
    Effect.gen(function* () {
      const store = yield* Store;
      const entry = (secret: Ports.SecretName) => `secret.${namespace}.${secret}`;

      const unavailable = (secret: Ports.SecretName) => () =>
        new Ports.SecretsUnavailable({ secret });

      return {
        get: (secret) =>
          store.get(entry(secret)).pipe(
            Effect.mapError(unavailable(secret)),
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.succeedNone,
                // Only `set` writes here, so a value that isn't base64 is a defect.
                onSome: (text) => Effect.asSome(decodeSecret(text).pipe(Effect.orDie)),
              }),
            ),
          ),
        set: (secret, value) =>
          store.set(entry(secret), Base64.encode(value)).pipe(Effect.mapError(unavailable(secret))),
        remove: (secret) => store.remove(entry(secret)).pipe(Effect.mapError(unavailable(secret))),
      };
    }),
  );

export * as Keychain from "./Keychain.ts";

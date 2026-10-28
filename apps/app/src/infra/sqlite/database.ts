import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Keychain } from "../keychain/Keychain.ts";
import { SecureStoreKeychain } from "../keychain/SecureStoreKeychain.ts";
import { ExpoSqliteClient } from "./ExpoSqliteClient.ts";

/**
 * This device's database as `SqlClient`: SQLCipher through expo-sqlite, keyed from the keychain
 * (ADR 0013). `database.web.ts` is the browser's.
 */
export const layer = Layer.unwrap(
  Effect.map(Keychain.databaseKey, (encryptionKey) =>
    ExpoSqliteClient.layer({ filename: "studienbuch.db", encryptionKey }),
  ),
).pipe(Layer.provide(SecureStoreKeychain.layer));

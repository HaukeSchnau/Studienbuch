import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Layer from "effect/Layer";
import * as SQLite from "expo-sqlite";

import { BackupExclusion } from "../backup/BackupExclusion.ts";
import { Keychain } from "../keychain/Keychain.ts";
import { Databases } from "./Databases.ts";
import { ExpoSqliteClient } from "./ExpoSqliteClient.ts";

// iOS and Android: SQLCipher through expo-sqlite, each database with its own random key in the
// keychain (ADR 0013). iOS backs up the database directory to iCloud, and the key stays behind.
// `database.web.ts` is the browser's.

const file = (location: Databases.Location) => `${location.name}.db`;

export const layer: Databases.Open = (location) =>
  Layer.unwrap(
    Effect.gen(function* () {
      if (location.memory) {
        return ExpoSqliteClient.layer({
          filename: ":memory:",
          encryptionKey: Hex.encode(globalThis.crypto.getRandomValues(new Uint8Array(32))),
        });
      }

      yield* BackupExclusion.excludeDatabases;

      return ExpoSqliteClient.layer({
        filename: file(location),
        encryptionKey: yield* Keychain.databaseKey(location.name),
      });
    }),
  );

// expo-sqlite reports a missing file with the same code as an open one, so only its message tells
// them apart: "Database … not found" on both platforms.
const notFound = (cause: unknown) => cause instanceof Error && /not found/u.test(cause.message);

export const remove: Databases.Remove = (location) =>
  location.memory
    ? Effect.void
    : Effect.tryPromise({
        try: () => SQLite.deleteDatabaseAsync(file(location)),
        catch: (cause) => new Databases.RemoveFailed({ cause }),
      }).pipe(
        Effect.catchIf(
          (error) => notFound(error.cause),
          () => Effect.void,
        ),
        Effect.andThen(Keychain.forgetDatabaseKey(location.name)),
      );

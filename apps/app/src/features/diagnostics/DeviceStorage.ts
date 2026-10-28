import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

import { layer } from "../../infra/sqlite/database.ts";

// The SQLite check: this device's database counts the app's starts, so a number that keeps rising
// across restarts proves the data survives them.

export * as DeviceStorage from "./DeviceStorage.ts";

export interface Report {
  readonly starts: number;
  readonly sqlite: string;
  /** SQLCipher's version and crypto provider. None where the database isn't encrypted (the web). */
  readonly cipher: Option.Option<{ readonly version: string; readonly provider: string }>;
}

const one = <S extends Schema.Top>(schema: S) => Schema.decodeUnknownEffect(Schema.Tuple([schema]));

const Count = Schema.Struct({ count: Schema.Int });
const Version = Schema.Struct({ version: Schema.String });
const CipherVersion = Schema.Struct({ cipher_version: Schema.String });
const CipherProvider = Schema.Struct({ cipher_provider: Schema.String });

const recordStart = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`CREATE TABLE IF NOT EXISTS app_start (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    count INTEGER NOT NULL
  )`;

  const [{ count }] = yield* one(Count)(
    yield* sql`INSERT INTO app_start (id, count) VALUES (1, 1)
      ON CONFLICT (id) DO UPDATE SET count = count + 1
      RETURNING count`,
  );

  const [{ version }] = yield* one(Version)(yield* sql`SELECT sqlite_version() AS version`);

  // Plain SQLite knows neither pragma and returns no row.
  const cipherVersion = yield* sql`PRAGMA cipher_version`;

  const cipher =
    cipherVersion.length === 0
      ? Option.none()
      : Option.some({
          version: (yield* one(CipherVersion)(cipherVersion))[0].cipher_version,
          provider: (yield* one(CipherProvider)(yield* sql`PRAGMA cipher_provider`))[0]
            .cipher_provider,
        });

  return { starts: count, sqlite: version, cipher } satisfies Report;
}).pipe(Effect.catchTags({ SchemaError: Effect.die }));

// The database stays open for the app's lifetime.
const database = Atom.runtime(layer).pipe(Atom.keepAlive);

/** This start, counted once when the app opens its database. */
export const thisStart = database.atom(recordStart).pipe(Atom.keepAlive);

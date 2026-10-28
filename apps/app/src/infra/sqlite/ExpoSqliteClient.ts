import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Client from "effect/sql/SqlClient";
import type * as SqlConnection from "effect/sql/SqlConnection";
import * as SqlError from "effect/sql/SqlError";
import * as Statement from "effect/sql/Statement";
import * as Stream from "effect/Stream";
import * as SQLite from "expo-sqlite";

// Effect's `SqlClient` on expo-sqlite, for iOS and Android (ADR 0013). Modelled on Effect's op-sqlite
// driver; A7 wrote it (client-platform.md) and WP-2 ran it on SQLCipher (spikes/native.md).

export interface Config {
  readonly filename: string;
  /**
   * SQLCipher's raw key as 64 hex characters. The connection sends it before any other statement.
   * Anything else that opens the same file has to do the same, which is why this client keeps one
   * connection and never uses `withExclusiveTransactionAsync`: that opens a second connection
   * without the key.
   */
  readonly encryptionKey: string;
}

// Effect's statement compiler hands over these kinds only, so anything else is a bug in a query. It
// fails the statement.
const params = Schema.decodeUnknownSync(
  Schema.Array(
    Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null, Schema.Uint8Array]),
  ),
);

const fail = (operation: string) => (cause: unknown) =>
  new SqlError.SqlError({
    reason: SqlError.classifySqliteError(cause, { message: `Failed to ${operation}`, operation }),
  });

const make = (config: Config) =>
  Effect.gen(function* () {
    const reactivity = yield* Reactivity.Reactivity;

    const db = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: async () => {
          const opened = await SQLite.openDatabaseAsync(config.filename, {
            enableChangeListener: true,
          });

          await opened.execAsync(`PRAGMA key = "x'${config.encryptionKey}'"`);

          return opened;
        },
        catch: fail("open the database"),
      }),
      (opened) => Effect.promise(() => opened.closeAsync()),
    );

    // sqlite3_update_hook to Reactivity, so `sql.reactive` queries run again after writes.
    const subscription = SQLite.addDatabaseChangeListener((change) => {
      if (change.databaseFilePath === db.databasePath) {
        reactivity.invalidateUnsafe({ [change.tableName]: [String(change.rowId)] });
      }
    });

    yield* Effect.addFinalizer(() => Effect.sync(() => subscription.remove()));

    const rows = (sql: string, values: ReadonlyArray<unknown>) =>
      Effect.tryPromise({
        try: () => db.getAllAsync<object>(sql, [...params(values)]),
        catch: fail("execute"),
      });

    const arrays = (sql: string, values: ReadonlyArray<unknown>) =>
      Effect.tryPromise({
        try: async () => {
          const statement = await db.prepareAsync(sql);

          try {
            const result = await statement.executeForRawResultAsync([...params(values)]);

            return await result.getAllAsync();
          } finally {
            await statement.finalizeAsync();
          }
        },
        catch: fail("execute"),
      });

    const connection: SqlConnection.Connection = {
      execute: (sql, values, transform) =>
        transform ? Effect.map(rows(sql, values), transform) : rows(sql, values),
      executeRaw: rows,
      executeValues: arrays,
      executeValuesUnprepared: arrays,
      executeUnprepared: (sql, values, transform) =>
        transform ? Effect.map(rows(sql, values), transform) : rows(sql, values),
      executeStream: (sql, values, transform) => {
        const stream = Stream.fromAsyncIterable(
          db.getEachAsync<object>(sql, [...params(values)]),
          fail("stream"),
        );

        return transform
          ? Stream.flattenIterable(Stream.map(stream, (row) => transform([row])))
          : stream;
      },
    };

    // One connection behind a semaphore: Effect issues BEGIN and COMMIT itself.
    const { acquirer, borrower, onCommitFailure, transactionAcquirer } = Client.makeSqliteAcquirers(
      {
        connection: Effect.succeed(connection),
        semaphore: yield* Semaphore.make(1),
      },
    );

    return yield* Client.make({
      driver: "expo-sqlite",
      acquirer,
      borrower,
      transactionAcquirer,
      onCommitFailure,
      compiler: Statement.makeCompilerSqlite(),
      releaseSavepoint: (name) => `RELEASE SAVEPOINT ${name}`,
      spanAttributes: [["db.system.name", "sqlite"]],
    });
  });

/** The database file `config.filename` as `SqlClient`. */
export const layer = (config: Config) =>
  Layer.effect(Client.SqlClient)(make(config)).pipe(Layer.provide(Reactivity.layer));

export * as ExpoSqliteClient from "./ExpoSqliteClient.ts";

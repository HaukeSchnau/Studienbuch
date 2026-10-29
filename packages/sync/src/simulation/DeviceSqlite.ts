/**
 * A device's in-memory SQLite for the simulation: Node's driver, with a scheduling point before
 * every statement. Node's driver is synchronous, so a crash could never land inside a transaction,
 * but expo-sqlite and the web's worker are asynchronous, so on a device one can.
 */
import { SqliteClient } from "@effect/sql-sqlite-node";
import * as Effect from "effect/Effect";
import * as Semaphore from "effect/Semaphore";
import * as SqlClient from "effect/sql/SqlClient";
import type * as SqlConnection from "effect/sql/SqlConnection";
import * as Statement from "effect/sql/Statement";
import * as Stream from "effect/Stream";

export * as DeviceSqlite from "./DeviceSqlite.ts";

const yielding = (connection: SqlConnection.Connection): SqlConnection.Connection => ({
  execute: (sql, params, transformRows) =>
    Effect.andThen(Effect.yieldNow, connection.execute(sql, params, transformRows)),
  executeRaw: (sql, params) => Effect.andThen(Effect.yieldNow, connection.executeRaw(sql, params)),
  executeStream: (sql, params, transformRows) =>
    Stream.unwrap(Effect.as(Effect.yieldNow, connection.executeStream(sql, params, transformRows))),
  executeValues: (sql, params) =>
    Effect.andThen(Effect.yieldNow, connection.executeValues(sql, params)),
  executeValuesUnprepared: (sql, params) =>
    Effect.andThen(Effect.yieldNow, connection.executeValuesUnprepared(sql, params)),
  executeUnprepared: (sql, params, transformRows) =>
    Effect.andThen(Effect.yieldNow, connection.executeUnprepared(sql, params, transformRows)),
});

/**
 * The client, as the node driver builds one, over its single connection. Taking the connection
 * holds the driver's own client for the scope, which nothing else uses.
 */
export const make = Effect.gen(function* () {
  const driver = yield* SqliteClient.make({ filename: ":memory:" });
  const connection = yielding(yield* driver.reserve);

  const acquirers = SqlClient.makeSqliteAcquirers({
    connection: Effect.succeed(connection),
    semaphore: yield* Semaphore.make(1),
  });

  return yield* SqlClient.make({
    ...acquirers,
    driver: "sqlite-node",
    compiler: Statement.makeCompilerSqlite(),
    spanAttributes: [],
    releaseSavepoint: (name) => `RELEASE SAVEPOINT ${name}`,
    beginTransaction: "BEGIN IMMEDIATE",
  });
});

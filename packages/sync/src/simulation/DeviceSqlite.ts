/**
 * A device's in-memory SQLite for the simulation: Node's driver, with a scheduling point and the
 * `before` hook ahead of every statement. Node's driver is synchronous, so a crash could never
 * land inside a transaction, but expo-sqlite and the web's worker are asynchronous, so on a device
 * one can. The hook counts statements, and may stop one for a crash to end.
 */
import { SqliteClient } from "@effect/sql-sqlite-node";
import * as Effect from "effect/Effect";
import * as Semaphore from "effect/Semaphore";
import * as SqlClient from "effect/sql/SqlClient";
import type * as SqlConnection from "effect/sql/SqlConnection";
import * as Statement from "effect/sql/Statement";
import * as Stream from "effect/Stream";

export * as DeviceSqlite from "./DeviceSqlite.ts";

/** Runs before each statement with its SQL. */
export type Before = (sql: string) => Effect.Effect<void>;

const yielding = (
  connection: SqlConnection.Connection,
  before: Before,
): SqlConnection.Connection => {
  const ahead = (sql: string) => Effect.andThen(Effect.yieldNow, before(sql));

  return {
    execute: (sql, params, transformRows) =>
      Effect.andThen(ahead(sql), connection.execute(sql, params, transformRows)),
    executeRaw: (sql, params) => Effect.andThen(ahead(sql), connection.executeRaw(sql, params)),
    executeStream: (sql, params, transformRows) =>
      Stream.unwrap(Effect.as(ahead(sql), connection.executeStream(sql, params, transformRows))),
    executeValues: (sql, params) =>
      Effect.andThen(ahead(sql), connection.executeValues(sql, params)),
    executeValuesUnprepared: (sql, params) =>
      Effect.andThen(ahead(sql), connection.executeValuesUnprepared(sql, params)),
    executeUnprepared: (sql, params, transformRows) =>
      Effect.andThen(ahead(sql), connection.executeUnprepared(sql, params, transformRows)),
  };
};

/**
 * The client, as the node driver builds one, over its single connection. Taking the connection
 * holds the driver's own client for the scope, which nothing else uses.
 */
export const make = Effect.fnUntraced(function* (before: Before) {
  const driver = yield* SqliteClient.make({ filename: ":memory:" });
  const connection = yielding(yield* driver.reserve, before);

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

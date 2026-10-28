import { PgClient } from "@effect/sql-pg";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";
import { inject } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    /** The socket directory of the throwaway server, or `null` when PostgreSQL 18 is missing. */
    postgres18: string | null;
  }
}

/**
 * The socket directory of the run's PostgreSQL 18, which `Postgres18.setup.ts` started, or `null`
 * when it isn't available. Tests that need it skip on `null`.
 */
export const socket = inject("postgres18");

/** A fresh database on the run's PostgreSQL 18, so test files running in parallel stay apart. */
export const database = (socket: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      // Names one throwaway database. Effect's Crypto service would have to reach every layer
      // that builds one.
      // oxlint-disable-next-line effecttsgo/crypto-random-uuid-in-effect -- see above
      const database = `stu_${crypto.randomUUID().replaceAll("-", "")}`;

      const admin = yield* Layer.build(
        PgClient.layer({ host: socket, username: "postgres", database: "postgres" }),
      );

      yield* Effect.provide(
        Effect.flatMap(SqlClient.SqlClient, (sql) => sql.unsafe(`create database ${database}`)),
        admin,
      );

      return PgClient.layer({ host: socket, username: "postgres", database, maxConnections: 20 });
    }),
  );

export * as Postgres18 from "./Postgres18.ts";

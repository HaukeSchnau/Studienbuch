/**
 * Runs `cases.jsonl` on a device's own SQLite, for builds the tests can't reach: expo-sqlite with
 * SQLCipher on Hermes, and the browsers' JavaScript engines. Give it an empty database, because the
 * cases count their spaces from one.
 *
 * ```ts
 * const results = yield* Replay.run.pipe(Effect.provide(scratchDatabase));
 * ```
 */
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";
import { DeviceDatabase } from "../client/DeviceDatabase.ts";
import { SqliteTx } from "../client/SqliteTx.ts";
import fixture from "./cases.jsonl";
import { Fixture } from "./Fixture.ts";
import ProbeMigrations from "./migrations/migrations.js";
import { Probe } from "./Probe.ts";

export * as Replay from "./Replay.ts";

export interface Result {
  readonly name: string;
  /** Whether this database reproduced what every engine in the tests returned. */
  readonly matches: boolean;
  /** This database's outcomes and stored rows, encoded like the fixture, for a report. */
  readonly actual: string;
  readonly expected: string;
}

/** Each case of the fixture on the provided database, in order. */
export const run = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* DeviceDatabase.migrate(ProbeMigrations.migrations);

  const engine: Probe.Engine = {
    side: "device",
    sql: (effect) => Effect.provideService(effect, SqlClient.SqlClient, sql),
    transaction: (effect) =>
      sql
        .withTransaction(Effect.provide(effect, SqliteTx.layer(Probe.runner)))
        .pipe(Effect.provideService(SqlClient.SqlClient, sql)),
  };

  const cases = yield* Fixture.decode(fixture).pipe(Effect.orDie);

  return yield* Effect.forEach(cases, ({ name, steps, expected }) =>
    Effect.map(Probe.run(engine, Probe.freshSpace(), steps), (trace): Result => {
      const actual = Fixture.encode(trace);

      return { name, matches: actual === expected, actual, expected };
    }),
  );
}).pipe(Effect.withSpan("Replay.run"));

import * as PgClient from "@effect/sql-pg/PgClient";
import { assert, describe, expect, it, layer } from "@effect/vitest";
import { Postgres18 } from "@stu/sync/testing";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";
import { Database } from "./Database.ts";

const connections = (env: Record<string, string>) =>
  Effect.exit(
    Database.connections.pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env })),
    ),
  );

describe("Database.connections", () => {
  it.effect("keeps serve, Better Auth, prepare and a console within the role's limit", () =>
    Effect.gen(function* () {
      for (const [env, total] of [
        [{ DATABASE_CONNECTIONS: "10" }, 10],
        [{}, 40],
      ] as const) {
        const pools = yield* Effect.flatten(connections(env));

        assert.strictEqual(pools.serve + pools.auth + 2 * pools.command, total);
        assert.isAtLeast(pools.serve, 3);
      }
    }),
  );

  it.effect("refuses a limit that leaves serve no connection beside the two it holds", () =>
    Effect.gen(function* () {
      assert.isTrue(Exit.isFailure(yield* connections({ DATABASE_CONNECTIONS: "8" })));
      assert.isTrue(Exit.isSuccess(yield* connections({ DATABASE_CONNECTIONS: "9" })));
    }),
  );
});

describe.skipIf(Postgres18.socket === null)("Database's pools", () => {
  layer(Postgres18.database(Postgres18.socket ?? ""))((it) => {
    it.effect("read a day as ISO text whatever DateStyle the database sets", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const [row] = yield* sql<{ readonly name: string }>`select current_database() as name`;
        const name = row?.name ?? "";
        yield* sql.unsafe(`alter database ${name} set datestyle = 'German, DMY'`);

        const host = Postgres18.socket ?? "";
        const env = { DATABASE_URL: `postgresql://postgres@localhost/${name}?host=${host}` };
        const config = ConfigProvider.layer(ConfigProvider.fromEnv({ env }));
        const day = "select date '2026-11-28'::text as day";
        const read = Effect.flatMap(SqlClient.SqlClient, (sql) => sql.unsafe(day));

        // node-postgres parses a timestamp from its text, too.
        const auth = Effect.flatMap(Database.authPool, (pool) =>
          Effect.promise(() =>
            pool.query<{ readonly day: string; readonly at: Date }>(
              `${day}, timestamptz '2026-11-28 06:30Z' as at`,
            ),
          ),
        ).pipe(
          Effect.map(({ rows }) => rows.map(({ day, at }) => ({ day, at: at.toISOString() }))),
          Effect.scoped,
          Effect.provide(config),
        );

        expect({
          // A connection without the pin follows the database, so the pin is what reads ISO.
          unpinned: yield* read.pipe(
            Effect.provide(PgClient.layer({ host, username: "postgres", database: name })),
          ),
          server: yield* read.pipe(Effect.provide(Database.layer.pipe(Layer.provide(config)))),
          auth: yield* auth,
        }).toEqual({
          unpinned: [{ day: "28.11.2026" }],
          server: [{ day: "2026-11-28" }],
          auth: [{ day: "2026-11-28", at: "2026-11-28T06:30:00.000Z" }],
        });
      }),
    );
  });
});

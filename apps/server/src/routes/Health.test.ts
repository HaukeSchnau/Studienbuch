import { describe, expect, layer } from "@effect/vitest";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Postgres18 } from "@stu/sync/testing";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import { Deployment } from "../infra/config/Deployment.ts";
import { Database } from "../infra/database/Database.ts";
import { Migrations } from "../infra/database/Migrations.ts";
import { Health } from "./Health.ts";

/** A pool of one connection, so a test that holds it leaves readiness none. */
const onePool = Layer.effect(Database.Drizzle)(PgDrizzle.makeWithDefaults()).pipe(
  Layer.provideMerge(
    PgClient.layer({
      host: Postgres18.socket ?? "",
      username: "postgres",
      database: "postgres",
      maxConnections: 1,
    }),
  ),
);

describe.skipIf(Postgres18.socket === null)("Health", () => {
  layer(
    Layer.mergeAll(
      onePool,
      Layer.succeed(Deployment.Current, { revision: "test", environment: "development" }),
      Layer.succeed(Migrations.Release, []),
    ),
  )((it) => {
    it.effect("readiness answers within two seconds when the pool has no connection free", () =>
      Effect.scoped(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* sql.reserve;
          const readiness = yield* Effect.forkChild(Health.readiness);
          yield* TestClock.adjust("2 seconds");

          expect((yield* Fiber.join(readiness)).status).toBe("database-unavailable");
        }),
      ),
    );
  });
});

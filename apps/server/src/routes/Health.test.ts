import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, layer } from "@effect/vitest";
import { Postgres18 } from "@stu/sync/testing";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as SqlClient from "effect/sql/SqlClient";
import * as TestClock from "effect/testing/TestClock";
import { Deployment } from "../infra/config/Deployment.ts";
import { Database } from "../infra/database/Database.ts";
import { Migrations } from "../infra/database/Migrations.ts";
import { Testing } from "../infra/database/Testing.ts";
import { Health } from "./Health.ts";

const release = Layer.unwrap(
  Effect.gen(function* () {
    const path = yield* Path.Path;

    return Migrations.layerRelease(path.join(import.meta.dirname, "../../migrations"));
  }),
);

const server = Layer.mergeAll(
  release,
  Layer.effect(Database.Drizzle)(PgDrizzle.makeWithDefaults()),
  Layer.succeed(Deployment.Current, { revision: "test", environment: "development" }),
).pipe(Layer.provideMerge(Testing.prepared), Layer.provideMerge(NodeServices.layer));

describe.skipIf(Postgres18.socket === null)("Health", () => {
  layer(server)((it) => {
    it.effect("readiness answers database-unavailable when the database doesn't answer", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const locked = yield* Deferred.make<void>();

        // Holds the history table, so the readiness query waits like it would on a full pool.
        yield* sql
          .withTransaction(
            Effect.andThen(
              sql`LOCK TABLE studienbuch_migration IN ACCESS EXCLUSIVE MODE`,
              Effect.andThen(Deferred.succeed(locked, undefined), Effect.never),
            ),
          )
          .pipe(Effect.forkScoped);

        yield* Deferred.await(locked);
        const probe = yield* Effect.forkScoped(Health.readiness);
        yield* TestClock.adjust(Health.timeout);

        assert.strictEqual((yield* Fiber.join(probe)).status, "database-unavailable");
      }),
    );
  });
});

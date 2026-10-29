/**
 * A database on PostgreSQL 18 at the release's schema, as `prepare` leaves it, with the sync
 * engine's writers, for the tests of admissions and the schools behind them.
 */
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Studienbuch } from "@stu/core";
import { SyncEpoch, SyncServer } from "@stu/sync/server";
import { Postgres18 } from "@stu/sync/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as SqlClient from "effect/sql/SqlClient";
import { Migrations } from "../infra/database/Migrations.ts";

export * as Fixture from "./Fixture.ts";

const prepared = Layer.effectDiscard(
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const folder = path.join(import.meta.dirname, "../../migrations");
    yield* Migrations.apply(yield* Migrations.read(folder));
    yield* SyncEpoch.initialize;
  }),
).pipe(Layer.provideMerge(Postgres18.database(Postgres18.socket ?? "")));

export const database = SyncServer.writers(Studienbuch.schema).pipe(
  Layer.provideMerge(prepared),
  Layer.provideMerge(NodeServices.layer),
);

/** An account as sign-up leaves it, with no name and a confirmed address. */
export const account = (id: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql`
      insert into auth_user (id, name, email, "emailVerified")
      values (${id}, '', ${`${id}@example.test`}, true)
    `,
  );

/** The spaces the account reads, as `<kind> <id> <role>`, sorted. */
export const memberships = (account: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly line: string }>`
      select s.kind || ' ' || s.id || ' ' || m.role as line
      from space_member m join space s on s.id = m.space_id
      where m.account_id = ${account}
      order by line
    `,
  ).pipe(Effect.map((rows) => rows.map((row) => row.line)));

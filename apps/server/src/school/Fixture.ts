/** The sync engine's writers on a prepared database, for the tests of admissions and schools. */
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Studienbuch } from "@stu/core";
import { SyncServer } from "@stu/sync/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";
import { Testing } from "../infra/database/Testing.ts";

export * as Fixture from "./Fixture.ts";

export const database = SyncServer.writers(Studienbuch.schema).pipe(
  Layer.provideMerge(Testing.prepared),
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

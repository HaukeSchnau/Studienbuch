/** The sync engine's writers on a prepared database, for the tests of admissions and schools. */
import * as NodeServices from "@effect/platform-node/NodeServices";
import { School, Studienbuch } from "@stu/core";
import type { Protocol } from "@stu/sync";
import { Pull, SyncServer } from "@stu/sync/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { DatabaseTesting } from "../infra/database/DatabaseTesting.ts";
import { Schools } from "./Schools.ts";

export * as SchoolTesting from "./SchoolTesting.ts";

export const database = SyncServer.writers(Studienbuch.schema).pipe(
  Layer.provideMerge(DatabaseTesting.prepared),
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

/** A publish that owns the school's rows, on the TestClock's first day. */
export const replacing = Schools.removeMissing(School.today(undefined, 0));

/** The days of the school's published lessons, in order. */
export const lessonDays = (school: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly date: string }>`
      select distinct r.data->>'date' as date from sync_row r join space s on s.id = r.space_id
      where s.parent_id = ${school} and r.tbl = 'Lesson' and r.data is not null
      order by date
    `,
  ).pipe(Effect.map((rows) => rows.map(({ date }) => date)));

/** One pull of the account's phone from `cursors`, which must fit on one page. */
export const pullOnce = (account: string, cursors: ReadonlyArray<typeof Protocol.Cursor.Type>) =>
  Effect.flatMap(Pull.Service, (service) =>
    service.pull(account, {
      clientId: `${account}-phone`,
      syncEpoch: null,
      contract: Studienbuch.schema.contract,
      cursors,
      settledMutationId: 0,
      limit: 1000,
    }),
  ).pipe(
    Effect.tap((response) =>
      response.more ? Effect.die("The pull didn't fit on one page") : Effect.void,
    ),
  );

const decodeDated = Schema.decodeUnknownOption(Schema.Struct({ date: Schema.String }));

/** A pull's lesson ops, by `<space> <id>`, with the day of each live one. */
export const lessonOps = (response: Effect.Success<ReturnType<typeof pullOnce>>) =>
  response.patches.flatMap(({ space, ops }) =>
    ops.flatMap(({ tbl, id, row }) =>
      tbl === "Lesson"
        ? [
            {
              key: `${space} ${id}`,
              tag: row._tag,
              date: row._tag === "Readable" ? decodeDated(row.data) : Option.none(),
            },
          ]
        : [],
    ),
  );

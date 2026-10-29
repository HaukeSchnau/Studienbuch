import { PgClient } from "@effect/sql-pg";
import { describe, expect, layer } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Queue from "effect/Queue";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Postgres18 } from "../testing/Postgres18.ts";
import { Tx } from "../transaction/Tx.ts";
import { Fixture } from "./Fixture.ts";
import { Pokes } from "./Pokes.ts";
import { Spaces } from "./Spaces.ts";
import { SyncEpoch } from "./SyncEpoch.ts";
import { SyncWriter } from "./SyncWriter.ts";

const PayloadJson = Schema.fromJsonString(Pokes.Payload);
const decodePayload = Schema.decodeEffect(PayloadJson);
const encodePayload = Schema.encodeEffect(PayloadJson);

/** Notifications on the poke channel, from a connection of their own. */
const listen = Effect.map(
  Effect.flatMap(PgClient.PgClient, (pg) => pg.listen(Pokes.channel)),
  (queue) => Effect.flatMap(Queue.take(queue), ({ payload }) => decodePayload(payload)),
);

/** What a pull would see of a space's table: live rows with their versions. */
const rows = (space: string, table: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly id: string; readonly version: number; readonly data: unknown }>`
      select id, version::float8 as version, data from sync_row
      where space_id = ${space} and tbl = ${table} and data is not null order by id
    `,
  );

const members = (space: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly account: string; readonly grantedBy: string | null }>`
      select account_id as account, granted_by as "grantedBy" from space_member
      where space_id = ${space} order by account_id
    `,
  );

const enroll = (notebook: string, courseIds: ReadonlyArray<string>) =>
  Effect.flatMap(SyncWriter.Service, (writer) =>
    writer.write(
      notebook,
      [Fixture.Enrollment],
      Effect.flatMap(Tx.Service, (tx) =>
        tx.put(Fixture.Enrollment, notebook, "term", { courseIds }),
      ),
    ),
  );

describe.skipIf(Postgres18.socket === null)("SyncWriter on PostgreSQL 18", () => {
  layer(Fixture.server)((it) => {
    it.effect(
      "reconcile writes what changed under one version, and deletes only what it covers",
      () =>
        Effect.gen(function* () {
          const spaces = yield* Spaces.Service;
          const writer = yield* SyncWriter.Service;
          yield* spaces.create("school-reconcile", Fixture.School);

          const lessons = (rooms: Record<string, string>) =>
            Object.entries(rooms).map(([id, room]) => ({ id, row: { room, day: id.slice(0, 3) } }));

          const first = yield* writer.reconcile(
            "school-reconcile",
            Fixture.Lesson,
            lessons({ "mon-1": "A1", "tue-1": "B2" }),
          );

          const again = yield* writer.reconcile(
            "school-reconcile",
            Fixture.Lesson,
            lessons({ "mon-1": "A1", "tue-1": "B2" }),
          );

          const moved = yield* writer.reconcile(
            "school-reconcile",
            Fixture.Lesson,
            lessons({ "mon-1": "C3" }),
          );

          expect([first, again, moved]).toEqual([
            { written: 2, removed: 0 },
            { written: 0, removed: 0 },
            { written: 1, removed: 0 },
          ]);

          expect(yield* rows("school-reconcile", "Lesson")).toEqual([
            { id: "mon-1", version: 2, data: { room: "C3", day: "mon" } },
            { id: "tue-1", version: 1, data: { room: "B2", day: "tue" } },
          ]);

          const monday = yield* writer.reconcile("school-reconcile", Fixture.Lesson, [], {
            covers: ({ row }) => row.day === "mon",
          });

          expect(monday).toEqual({ written: 0, removed: 1 });
          expect((yield* rows("school-reconcile", "Lesson")).map(({ id }) => id)).toEqual([
            "tue-1",
          ]);
        }),
    );

    it.effect(
      "a write pokes its space on commit, and a reconcile that changes nothing pokes nothing",
      () =>
        Effect.gen(function* () {
          const spaces = yield* Spaces.Service;
          const writer = yield* SyncWriter.Service;
          const sql = yield* SqlClient.SqlClient;
          const next = yield* listen;
          yield* spaces.create("school-pokes", Fixture.School);
          const lesson = [{ id: "mon-1", row: { room: "A1", day: "mon" } }];
          const wrote = yield* Deferred.make<void>();
          const commit = yield* Deferred.make<void>();

          const open = yield* Effect.forkChild(
            sql.withTransaction(
              Effect.andThen(writer.reconcile("school-pokes", Fixture.Lesson, lesson), () =>
                Effect.andThen(Deferred.succeed(wrote, undefined), Deferred.await(commit)),
              ),
            ),
          );

          // Postgres delivers notifications in commit order, so a marker committed while the write
          // is still open arrives first unless the write notified outside its transaction.
          yield* Deferred.await(wrote);

          const marker = yield* encodePayload({
            spaces: [],
            accounts: ["marker"],
          });

          yield* sql`select pg_notify(${Pokes.channel}, ${marker})`;
          expect(yield* next).toEqual({ spaces: [], accounts: ["marker"] });
          yield* Deferred.succeed(commit, undefined);
          yield* Fiber.join(open);
          expect(yield* next).toEqual({
            spaces: [{ space: "school-pokes", version: 1 }],
            accounts: [],
          });

          yield* writer.reconcile("school-pokes", Fixture.Lesson, lesson);
          yield* writer.reconcile("school-pokes", Fixture.Lesson, [
            { id: "mon-1", row: { room: "B2", day: "mon" } },
          ]);
          expect(yield* next).toEqual({
            spaces: [{ space: "school-pokes", version: 2 }],
            accounts: [],
          });
        }),
    );

    it.effect(
      "an enrollment makes its notebook's owner a reader of the courses it lists, and only those",
      () =>
        Effect.gen(function* () {
          const spaces = yield* Spaces.Service;
          const next = yield* listen;
          yield* spaces.create("lena", Fixture.Notebook);
          yield* spaces.create("tom", Fixture.Notebook);
          yield* spaces.addMember("lena", "account-lena", "owner");

          for (const course of ["ma", "de", "en"]) yield* spaces.create(course, Fixture.Course);
          // Lena reads English through her school's admission, not through the rule.
          yield* spaces.addMember("en", "account-lena", "reader");
          expect([yield* next, yield* next]).toEqual([
            { spaces: [], accounts: ["account-lena"] },
            { spaces: [], accounts: ["account-lena"] },
          ]);

          yield* enroll("lena", ["ma", "de", "en"]);
          expect(yield* next).toEqual({ spaces: [{ space: "lena", version: 1 }], accounts: [] });
          expect(yield* next).toEqual({ spaces: [], accounts: ["account-lena"] });

          expect([yield* members("ma"), yield* members("de"), yield* members("en")]).toEqual([
            [{ account: "account-lena", grantedBy: "lena" }],
            [{ account: "account-lena", grantedBy: "lena" }],
            [{ account: "account-lena", grantedBy: null }],
          ]);

          // A modified app names another student's notebook and an id that is no space.
          yield* enroll("lena", ["de", "tom", "missing"]);

          expect([
            yield* members("ma"),
            yield* members("de"),
            yield* members("en"),
            yield* members("tom"),
          ]).toEqual([
            [],
            [{ account: "account-lena", grantedBy: "lena" }],
            [{ account: "account-lena", grantedBy: null }],
            [],
          ]);
        }),
    );

    it.effect(
      "prepare writes one restore epoch however often it runs, and the epoch carries it",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          yield* Effect.all([SyncEpoch.initialize, SyncEpoch.initialize, SyncEpoch.initialize], {
            concurrency: "unbounded",
          });
          const ids = yield* sql<{ readonly id: string }>`select id::text as id from sync_epoch`;

          expect(ids).toHaveLength(1);
          expect((yield* SyncEpoch.current).split(":")[0]).toBe(ids[0]?.id);
        }),
    );
  });
});

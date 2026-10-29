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

/** The spaces an account reads, each with the space whose rows granted it. */
const memberships = (account: string) =>
  Effect.flatMap(SqlClient.SqlClient, (sql) =>
    sql<{ readonly space: string; readonly grantedBy: string | null }>`
      select space_id as space, granted_by as "grantedBy" from space_member
      where account_id = ${account} order by space_id
    `.pipe(
      Effect.map((rows) => rows.map((row): [string, string | null] => [row.space, row.grantedBy])),
    ),
  );

/** A school `<name>-school` with its courses, and Lena and Tom admitted with a notebook each. */
const school = (name: string, courses: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const spaces = yield* Spaces.Service;
    const school = `${name}-school`;
    yield* spaces.create(school, Fixture.School);

    for (const course of courses) {
      yield* spaces.create(`${name}-${course}`, Fixture.Course, { parent: school, key: course });
    }

    for (const student of ["lena", "tom"]) {
      yield* spaces.create(`${name}-${student}`, Fixture.Notebook, { parent: school });
      yield* spaces.addMember(`${name}-${student}`, `${name}-account-${student}`, "owner");
      yield* spaces.addMember(school, `${name}-account-${student}`, "reader");
    }

    return { lena: `${name}-account-lena`, tom: `${name}-account-tom` };
  });

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
          const { lena } = yield* school("grants", ["ma", "de", "en"]);
          const next = yield* listen;
          // Lena reads English through her school's admission, not through the rule.
          yield* spaces.addMember("grants-en", lena, "reader");
          expect(yield* next).toEqual({ spaces: [], accounts: [lena] });

          yield* enroll("grants-lena", ["ma", "de", "en"]);
          expect(yield* next).toEqual({
            spaces: [{ space: "grants-lena", version: 1 }],
            accounts: [],
          });
          expect(yield* next).toEqual({ spaces: [], accounts: [lena] });

          expect(yield* memberships(lena)).toEqual([
            ["grants-de", "grants-lena"],
            ["grants-en", null],
            ["grants-lena", null],
            ["grants-ma", "grants-lena"],
            ["grants-school", null],
          ]);

          // A modified app names another student's notebook, the school and an id that is no space.
          yield* enroll("grants-lena", ["de", "grants-tom", "grants-school", "missing"]);

          expect(yield* memberships(lena)).toEqual([
            ["grants-de", "grants-lena"],
            ["grants-en", null],
            ["grants-lena", null],
            ["grants-school", null],
          ]);
        }),
    );

    it.effect("a forged enrollment naming another school's courses grants nothing", () =>
      Effect.gen(function* () {
        const spaces = yield* Spaces.Service;
        const { lena } = yield* school("here", ["ma"]);
        // Course ids repeat across schools: both offer a "ma".
        yield* school("there", ["ma", "ph"]);
        // Lena attends both, with a notebook at each.
        yield* spaces.create("there-lena-2", Fixture.Notebook, { parent: "there-school" });
        yield* spaces.addMember("there-lena-2", lena, "owner");
        yield* spaces.addMember("there-school", lena, "reader");
        yield* enroll("here-lena", ["ma", "ph"]);

        expect((yield* memberships(lena)).filter(([space]) => !space.endsWith("school"))).toEqual([
          ["here-lena", null],
          ["here-ma", "here-lena"],
          ["there-lena-2", null],
        ]);
      }),
    );

    it.effect("after leaving a school, a new enrollment write grants nothing for it", () =>
      Effect.gen(function* () {
        const spaces = yield* Spaces.Service;
        const { lena } = yield* school("leaving", ["ma"]);
        yield* enroll("leaving-lena", ["ma"]);
        yield* spaces.removeMember("leaving-school", lena);
        const left = yield* memberships(lena);
        yield* enroll("leaving-lena", ["ma"]);

        expect([left, yield* memberships(lena)]).toEqual([
          [["leaving-lena", null]],
          [["leaving-lena", null]],
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

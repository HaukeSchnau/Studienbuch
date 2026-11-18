import * as NodeServices from "@effect/platform-node/NodeServices";
import * as PgClient from "@effect/sql-pg/PgClient";
import { describe, expect, layer } from "@effect/vitest";
import {
  Course,
  CourseOffering,
  Enrollment,
  Notebook,
  School,
  SchoolYear,
  Studienbuch,
  Term,
} from "@stu/core";
import { CryptoSuite } from "@stu/e2ee";
import { Command } from "@stu/sync";
import { Listener, Ports, Push, Spaces, SyncServer, SyncWriter } from "@stu/sync/server";
import { Postgres18 } from "@stu/sync/testing";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import { Deletion } from "../account/Deletion.ts";
import { DatabaseTesting } from "../infra/database/DatabaseTesting.ts";
import { SchoolTesting } from "../school/SchoolTesting.ts";
import { Sync } from "./Sync.ts";

/** No sessions: these tests write and push rows, and open no connection. */
const noSessions = Layer.succeed(
  Ports.SessionResolver,
  Ports.SessionResolver.of({ resolve: () => Effect.succeedNone, revoked: Stream.never }),
);

/** Holds Mia's first push right after it holds her account, until `release`. */
class Pause extends Context.Service<
  Pause,
  { readonly held: Deferred.Deferred<void>; readonly release: Deferred.Deferred<void> }
>()("Test.Pause") {}

const pausing = Layer.effect(Ports.Accounts)(
  Effect.gen(function* () {
    const accounts = yield* Ports.Accounts;
    const pause = yield* Pause;

    return Ports.Accounts.of({
      hold: (account) =>
        Effect.tap(accounts.hold(account), () =>
          account === "mia"
            ? Effect.andThen(Deferred.succeed(pause.held, undefined), Deferred.await(pause.release))
            : Effect.void,
        ),
    });
  }),
).pipe(
  Layer.provide(Deletion.accounts),
  Layer.provideMerge(
    Layer.effect(Pause)(
      Effect.all({ held: Deferred.make<void>(), release: Deferred.make<void>() }),
    ),
  ),
);

const engine = SyncServer.layer(Studienbuch.schema).pipe(
  Layer.provideMerge(Listener.layer(PgClient.PgClient, (notification) => notification.payload)),
  Layer.provideMerge(
    Layer.mergeAll(noSessions, Sync.accountKeys, pausing, Deletion.ended, CryptoSuite.layer),
  ),
  Layer.provideMerge(DatabaseTesting.prepared),
  Layer.provideMerge(NodeServices.layer),
);

/** Rows as the import writes them, decoded from their stored JSON. */
const rows = <A>(
  decode: (json: Schema.Json) => Effect.Effect<A, Schema.SchemaError>,
  entries: { readonly [id: string]: Schema.Json },
) =>
  Effect.forEach(Object.entries(entries), ([id, json]) =>
    Effect.map(decode(json), (row) => ({ id, row })),
  );

const decodeSchool = Schema.decodeUnknownEffect(School.Row.codec);
const decodeSchoolYear = Schema.decodeUnknownEffect(SchoolYear.Row.codec);
const decodeTerm = Schema.decodeUnknownEffect(Term.Row.codec);
const decodeCourse = Schema.decodeUnknownEffect(Course.Row.codec);
const decodeOffering = Schema.decodeUnknownEffect(CourseOffering.Row.codec);
const decodeNotebook = Schema.decodeUnknownEffect(Notebook.Row.codec);

/** A school with one term and its courses, each with a Course space under the school. */
const school = Effect.fn("SyncTest.school")(function* (id: string, courses: ReadonlyArray<string>) {
  const spaces = yield* Spaces.Service;
  const writer = yield* SyncWriter.Service;
  const year = `${id}-2026-27`;
  const term = `${id}-winter`;
  const dates = { start: "2026-08-01", end: "2027-01-31" };
  yield* spaces.create(id, School.Space);
  yield* writer.reconcile(
    id,
    School.Row,
    yield* rows(decodeSchool, { [id]: { name: id, timeZone: "Europe/Berlin" } }),
  );
  yield* writer.reconcile(
    id,
    SchoolYear.Row,
    yield* rows(decodeSchoolYear, { [year]: { name: "2026/27", dates } }),
  );
  yield* writer.reconcile(
    id,
    Term.Row,
    yield* rows(decodeTerm, { [term]: { schoolYearId: year, name: "Winter", dates } }),
  );
  yield* writer.reconcile(
    id,
    Course.Row,
    yield* rows(
      decodeCourse,
      Object.fromEntries(courses.map((course) => [course, { name: course }])),
    ),
  );

  yield* writer.reconcile(
    id,
    CourseOffering.Row,
    yield* rows(
      decodeOffering,
      Object.fromEntries(
        courses.map((course) => [
          `${course}@${term}`,
          { courseId: course, termId: term, gradeLevels: [11], classIds: [] },
        ]),
      ),
    ),
  );

  for (const course of courses)
    yield* spaces.create(course, Course.Space, { parent: id, key: course });

  return { id, term };
});

/** Admits the account to the school with a notebook there, as the admission does. */
const admit = Effect.fn("SyncTest.admit")(function* (
  account: string,
  school: string,
  notebook: string,
) {
  const spaces = yield* Spaces.Service;
  const writer = yield* SyncWriter.Service;
  yield* spaces.create(notebook, Notebook.Space, { parent: school });
  yield* spaces.addMember(notebook, account, "owner");
  yield* spaces.addMember(school, account, "reader");
  yield* writer.reconcile(
    notebook,
    Notebook.Row,
    yield* rows(decodeNotebook, { [notebook]: { schoolId: school } }),
  );
});

const enroll = (
  mutationId: number,
  notebook: string,
  termId: string,
  courseIds: ReadonlyArray<string>,
) =>
  Command.Mutate.make({
    mutationId,
    name: Enrollment.set.name,
    version: Enrollment.set.version,
    args: { notebook, termId, gradeLevel: 11, courseIds },
    at: DateTime.makeUnsafe(0),
  });

/** What the account's push answered, as `<mutation id> <outcome or refusal>`. */
const pushAs = (account: string, client: string, commands: ReadonlyArray<Command.Any>) =>
  Effect.flatMap(Push.Service, (service) =>
    service.push(account, {
      clientId: client,
      syncEpoch: null,
      contract: Studienbuch.schema.contract,
      commands,
    }),
  ).pipe(
    Effect.map(({ outcomes }) =>
      outcomes.map(
        (outcome) =>
          `${outcome.mutationId} ${outcome._tag === "Rejected" ? outcome.reason._tag : outcome._tag}`,
      ),
    ),
  );

const push = (client: string, commands: ReadonlyArray<Command.Any>) =>
  pushAs("lena", client, commands);

const courses = Effect.flatMap(SqlClient.SqlClient, (sql) =>
  sql<{ readonly space: string }>`
    select m.space_id as space from space_member m join space s on s.id = m.space_id
    where m.account_id = 'lena' and s.kind = 'course' order by m.space_id
  `.pipe(Effect.map((rows) => rows.map((row) => row.space))),
);

describe.skipIf(Postgres18.socket === null)("Sync with Studienbuch's definition", () => {
  layer(engine)((it) => {
    it.effect(
      "an enrollment reaches only its notebook's own school, and only while Lena attends it",
      () =>
        Effect.gen(function* () {
          yield* SchoolTesting.account("lena");
          const here = yield* school("here", ["here-ma", "here-de"]);
          const there = yield* school("there", ["there-ph"]);
          // Lena attends both schools, with a notebook at each.
          yield* admit("lena", here.id, "lena-here");
          yield* admit("lena", there.id, "lena-there");

          const answers = yield* push("lena-phone", [
            // Another school's term, and another school's course in this school's term.
            enroll(1, "lena-here", there.term, ["there-ph"]),
            enroll(2, "lena-here", here.term, ["here-ma", "there-ph"]),
            enroll(3, "lena-here", here.term, ["here-ma"]),
          ]);

          const enrolled = yield* courses;
          yield* (yield* Spaces.Service).removeMember(here.id, "lena");
          const left = yield* courses;

          // After she left the school, a new enrollment reads none of its rows and grants nothing.
          const afterwards = yield* push("lena-phone", [
            enroll(4, "lena-here", here.term, ["here-ma", "here-de"]),
          ]);

          expect({ answers, enrolled, left, afterwards, after: yield* courses }).toEqual({
            answers: ["1 Enrollment.UnknownTerm", "2 Enrollment.CourseNotOffered", "3 Applied"],
            enrolled: ["here-ma"],
            left: [],
            afterwards: ["4 Enrollment.UnknownTerm"],
            after: [],
          });
        }),
    );

    // Mia's phone pushes over a connection still open while she deletes her account. Her deletion
    // waits for the push and deletes what it wrote, and a push after it writes nothing.
    it.effect("a push racing a deletion leaves nothing of the account", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const pause = yield* Pause;
        const race = yield* school("race", ["race-ma"]);
        yield* SchoolTesting.account("mia");
        yield* admit("mia", race.id, "mia-notebook");

        yield* sql`
          insert into school_access (account_id, school_id, notebook_id)
          values ('mia', ${race.id}, 'mia-notebook')
        `;

        const pushing = yield* Effect.forkChild(
          pushAs("mia", "mia-phone", [enroll(1, "mia-notebook", race.term, ["race-ma"])]),
        );

        yield* Deferred.await(pause.held);
        const deleting = yield* Effect.forkChild(Deletion.run("mia"));

        // The deletion runs to its end, or waits for the account the push holds.
        yield* Effect.raceFirst(
          Effect.asVoid(Fiber.await(deleting)),
          sql<{ readonly waiting: number }>`
            select count(*)::int as waiting from pg_stat_activity
            where datname = current_database() and wait_event_type = 'Lock'
          `.pipe(Effect.repeat({ until: ([row]) => (row?.waiting ?? 0) > 0 }), Effect.asVoid),
        );

        yield* Deferred.succeed(pause.release, undefined);
        const raced = yield* Effect.exit(Fiber.join(pushing));
        yield* Fiber.join(deleting);

        const after = yield* Effect.exit(
          pushAs("mia", "mia-laptop", [enroll(1, "mia-notebook", race.term, ["race-ma"])]),
        );

        const left = yield* sql<{ readonly line: string }>`
          select 'sync_client ' || id as line from sync_client where account_id = 'mia'
          union all select 'command_log ' || client_id from command_log where account_id = 'mia'
          union all select 'space_member ' || space_id from space_member where account_id = 'mia'
          union all select 'space ' || id from space where id = 'mia-notebook'
        `;

        expect({
          raced: Exit.isSuccess(raced),
          after: Exit.isFailure(after),
          left: left.map((row) => row.line),
        }).toEqual({ raced: true, after: true, left: [] });
      }),
    );
  });
});

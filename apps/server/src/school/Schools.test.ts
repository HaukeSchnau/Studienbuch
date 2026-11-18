import * as NodeServices from "@effect/platform-node/NodeServices";
import * as PgClient from "@effect/sql-pg/PgClient";
import { describe, expect, layer } from "@effect/vitest";
import {
  CivilTime,
  Course,
  CourseOffering,
  Enrollment,
  type Lesson,
  School,
  Studienbuch,
  Term,
} from "@stu/core";
import { CryptoSuite } from "@stu/e2ee";
import { Command } from "@stu/sync";
import { Listener, Ports, Push, Spaces, SyncServer, SyncWriter } from "@stu/sync/server";
import { Postgres18 } from "@stu/sync/testing";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Statement from "effect/sql/Statement";
import * as Stream from "effect/Stream";
import { Deletion } from "../account/Deletion.ts";
import { DatabaseTesting } from "../infra/database/DatabaseTesting.ts";
import { Sync } from "../sync/Sync.ts";
import { Access } from "./Access.ts";
import { SchoolTesting } from "./SchoolTesting.ts";
import { Schools } from "./Schools.ts";

/** No sessions: these tests publish and push, and open no connection. */
const noSessions = Layer.succeed(
  Ports.SessionResolver,
  Ports.SessionResolver.of({ resolve: () => Effect.succeedNone, revoked: Stream.never }),
);

const engine = SyncServer.layer(Studienbuch.schema).pipe(
  Layer.provideMerge(Listener.layer(PgClient.PgClient, (notification) => notification.payload)),
  Layer.provideMerge(
    Layer.mergeAll(noSessions, Sync.accountKeys, Deletion.accounts, Deletion.ended),
  ),
  Layer.provideMerge(CryptoSuite.layer),
  Layer.provideMerge(DatabaseTesting.prepared),
  Layer.provideMerge(NodeServices.layer),
);

const term = Term.Id.make("2026-1");

type EncodedLesson = Schema.Struct.Encoded<(typeof Lesson.Row)["fields"]>;

const lesson = (courseId: string, date: string): EncodedLesson => ({
  courseId,
  date,
  start: 28_800_000,
  end: 34_200_000,
  teacherIds: ["bra"],
  roomIds: [],
  status: "Regular",
});

/** A school with a term and its courses, each offered in the term, and nothing else. */
const schoolWith = (id: string, courses: ReadonlyArray<string>): Schools.Data => ({
  id: School.Id.make(id),
  school: { name: id, timeZone: "Europe/Berlin" },
  schoolYears: { 2026: { name: "2026/27", dates: { start: "2026-08-01", end: "2027-07-31" } } },
  terms: {
    [term]: {
      schoolYearId: "2026",
      name: "1. Halbjahr 2026/27",
      dates: { start: "2026-08-01", end: "2027-01-31" },
    },
  },
  subjects: {},
  classes: {},
  courses: Object.fromEntries(courses.map((course) => [course, { name: course.toUpperCase() }])),
  offerings: Object.fromEntries(
    courses.map((courseId) => [
      `${courseId}@${term}`,
      { courseId, termId: term, gradeLevels: [11], classIds: [] },
    ]),
  ),
  teachers: { bra: { shortName: "BRA" } },
  rooms: {},
  closures: {},
  weekLabels: {},
  lessons: {},
});

/** 18 November 2026, a Wednesday. */
const wednesday = School.today(undefined, Date.parse("2026-11-18T09:00:00Z"));

const decodeRanges = Schema.decodeUnknownEffect(Schema.Array(CivilTime.DateRange));

const decodeOffering = Schema.decodeEffect(CourseOffering.Row.codec);

const ranges = (pairs: ReadonlyArray<ReadonlyArray<string>>) =>
  pairs.map(([start = "", end = ""]) => ({ start, end }));

const keepAll: Schools.Removals = { today: wednesday, lesson: () => false, closureDates: () => [] };

const lessonsOf = (school: string, course: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const space = yield* Schools.courseSpace(School.Id.make(school), course);

    const rows = yield* sql<{ readonly id: string }>`
      select id from sync_row where space_id = ${space} and tbl = 'Lesson' and data is not null
      order by id
    `;

    return rows.map((row) => row.id);
  });

/** The school's closures, as `<id> <start>..<end> ...`. */
const closuresOf = (school: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly line: string }>`
      select id || ' ' || (
        select string_agg((range ->> 'start') || '..' || (range ->> 'end'), ' ')
        from jsonb_array_elements(data -> 'dates') as range
      ) as line
      from sync_row where space_id = ${school} and tbl = 'Closure' and data is not null
      order by id
    `,
  ).pipe(Effect.map((rows) => rows.map((row) => row.line)));

/** Every space of the school with its version. */
const versions = (school: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly id: string; readonly version: string }>`
      select id, version::text as version from space
      where id = ${school} or parent_id = ${school} order by id
    `,
  );

/** The locks a publish that creates a Course space takes first: the school and its spaces. */
const publishLocks = (school: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql`
      select 1 from space where id = ${school} or parent_id = ${school} order by id
      for no key update
    `,
  );

/**
 * Takes `locks` in a transaction and holds them until `waiting` waits for one, then runs `rest` in
 * that transaction, as a publish or a command would after its first locks. Both finish.
 */
const interleave = <E1, R1, A2, E2, R2, A3, E3, R3>(
  locks: Effect.Effect<unknown, E1, R1>,
  rest: Effect.Effect<A2, E2, R2>,
  waiting: Effect.Effect<A3, E3, R3>,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const held = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();

    const first = yield* Effect.forkChild(
      Effect.exit(
        sql.withTransaction(
          Effect.gen(function* () {
            yield* locks;
            yield* Deferred.succeed(held, undefined);
            yield* Deferred.await(release);

            return yield* rest;
          }),
        ),
      ),
    );

    yield* Deferred.await(held);
    const second = yield* Effect.forkChild(Effect.exit(waiting));
    yield* DatabaseTesting.someoneWaits;
    yield* Deferred.succeed(release, undefined);

    return { held: yield* Fiber.join(first), waited: yield* Fiber.join(second) };
  });

/** Lena with a notebook at the school, admitted as sign-up admits her. */
const admitted = (account: string, school: string) =>
  Effect.gen(function* () {
    yield* SchoolTesting.account(account);

    const { notebook } = yield* Access.admit(account, School.Id.make(school), Option.none());

    return notebook;
  });

const enroll = (account: string, notebook: string, courseIds: ReadonlyArray<string>) =>
  Effect.flatMap(Push.Service, (service) =>
    service.push(account, {
      clientId: `${account}-phone`,
      syncEpoch: null,
      contract: Studienbuch.schema.contract,
      commands: [
        Command.Mutate.make({
          mutationId: 1,
          name: Enrollment.set.name,
          version: Enrollment.set.version,
          args: { notebook, termId: term, gradeLevel: 11, courseIds },
          at: DateTime.makeUnsafe(0),
        }),
      ],
    }),
  ).pipe(Effect.map(({ outcomes }) => outcomes.map((outcome) => outcome._tag)));

const outcome = <A, E>(exit: Exit.Exit<A, E>) => (Exit.isSuccess(exit) ? "done" : String(exit));

describe.skipIf(Postgres18.socket === null)("Schools.publish on PostgreSQL 18", () => {
  layer(engine)((it) => {
    it.effect(
      "removes only the lessons the caller names, also from a course that has none left",
      () =>
        Effect.gen(function* () {
          const school = schoolWith("am-see", ["ma-1", "de-1"]);

          yield* Schools.publish(
            {
              ...school,
              lessons: {
                "ma-1": {
                  "ma-1-mon": lesson("ma-1", "2026-11-16"),
                  "ma-1-tue": lesson("ma-1", "2026-11-17"),
                  "ma-1-wed": lesson("ma-1", "2026-11-18"),
                },
                "de-1": { "de-1-mon": lesson("de-1", "2026-11-16") },
              },
            },
            keepAll,
          );

          // Tuesday's and German's are named, and so is Monday's, which `Data` still holds.
          const named = new Set(["ma-1-mon", "ma-1-tue", "de-1-mon"]);

          yield* Schools.publish(
            { ...school, lessons: { "ma-1": { "ma-1-mon": lesson("ma-1", "2026-11-16") } } },
            { ...keepAll, lesson: ({ id }) => named.has(id) },
          );

          expect({
            math: yield* lessonsOf("am-see", "ma-1"),
            german: yield* lessonsOf("am-see", "de-1"),
          }).toEqual({ math: ["ma-1-mon", "ma-1-wed"], german: [] });
        }),
    );

    it.effect("publishing the same data again advances no space", () =>
      Effect.gen(function* () {
        const school: Schools.Data = {
          ...schoolWith("am-teich", ["ma-1"]),
          closures: {
            herbst: { name: "Herbstferien", dates: [{ start: "2026-10-12", end: "2026-10-24" }] },
          },
          weekLabels: { "2026-W47": { label: "A" } },
          importStatus: { observedAt: "2026-11-18T06:30:00.000Z", coveredUntil: "2026-12-15" },
          lessons: { "ma-1": { "ma-1-wed": lesson("ma-1", "2026-11-18") } },
        };

        yield* Schools.publish(school, Schools.removeMissing(wednesday));
        const first = yield* versions("am-teich");
        yield* Schools.publish(school, Schools.removeMissing(wednesday));

        expect(yield* versions("am-teich")).toEqual(first);
      }),
    );

    // Today is Wednesday, 18 November. Each row publishes `published`, then `data` with `removable`
    // as the closure dates the caller has evidence for.
    it.effect.each([
      {
        name: "a range reduced under the same id loses only the dates it no longer holds",
        school: "ferien-1",
        published: [["2026-11-23", "2026-11-27"]],
        data: [["2026-11-23", "2026-11-25"]],
        removable: [["2026-11-23", "2026-11-27"]],
        after: ["2026-11-23..2026-11-25"],
      },
      {
        name: "a removal that overlaps part of a closure takes only the dates they share",
        school: "ferien-2",
        published: [["2026-11-23", "2026-11-27"]],
        data: null,
        removable: [["2026-11-26", "2026-12-04"]],
        after: ["2026-11-23..2026-11-25"],
      },
      {
        name: "a closure that began yesterday and is withdrawn today keeps yesterday",
        school: "ferien-3",
        published: [["2026-11-17", "2026-11-20"]],
        data: null,
        removable: [["2026-11-17", "2026-11-20"]],
        after: ["2026-11-17..2026-11-17"],
      },
      {
        name: "a closure that now starts after today keeps its past dates as a range of their own",
        school: "ferien-4",
        published: [["2026-11-16", "2026-11-20"]],
        data: [["2026-11-19", "2026-11-20"]],
        removable: [["2026-11-16", "2026-11-20"]],
        after: ["2026-11-16..2026-11-17", "2026-11-19..2026-11-20"],
      },
      {
        name: "a closure that data lacks stays without evidence",
        school: "ferien-5",
        published: [["2026-11-23", "2026-11-27"]],
        data: null,
        removable: [],
        after: ["2026-11-23..2026-11-27"],
      },
      {
        name: "a closure without a date left goes",
        school: "ferien-6",
        published: [["2026-11-23", "2026-11-27"]],
        data: null,
        removable: [["2026-11-23", "2026-11-27"]],
        after: null,
      },
    ])("$name", ({ school: id, published, data, removable, after }) =>
      Effect.gen(function* () {
        const school = schoolWith(id, []);
        const evidence = yield* decodeRanges(ranges(removable));

        yield* Schools.publish(
          { ...school, closures: { ferien: { name: "Ferien", dates: ranges(published) } } },
          keepAll,
        );

        yield* Schools.publish(
          {
            ...school,
            closures: data === null ? {} : { ferien: { name: "Ferien", dates: ranges(data) } },
          },
          { ...keepAll, closureDates: () => evidence },
        );

        expect(yield* closuresOf(id)).toEqual(after === null ? [] : [`ferien ${after.join(" ")}`]);
      }),
    );

    it.effect("a publish that creates a course space finishes next to an enrollment.set", () =>
      Effect.gen(function* () {
        const before = schoolWith("am-fluss", ["ma-1"]);
        const after = schoolWith("am-fluss", ["ma-1", "ph-1"]);
        yield* Schools.publish(before, keepAll);
        const lena = yield* admitted("lena-fluss", "am-fluss");
        const tom = yield* admitted("tom-fluss", "am-fluss");

        // The publish holds its locks while Lena's choice waits.
        const publishFirst = yield* interleave(
          publishLocks("am-fluss"),
          Schools.publish(after, keepAll),
          enroll("lena-fluss", lena, ["ma-1", "ph-1"]),
        );

        // Tom's choice holds his notebook, as the command does, while a publish waits.
        const choiceFirst = yield* interleave(
          Effect.flatMap(
            SqlClient.SqlClient,
            (sql) => sql`select 1 from space where id = ${tom} for no key update`,
          ),
          enroll("tom-fluss", tom, ["ma-1", "ph-1"]),
          Schools.publish(schoolWith("am-fluss", ["ma-1", "ph-1", "ch-1"]), keepAll),
        );

        expect({
          publishFirst: [outcome(publishFirst.held), outcome(publishFirst.waited)],
          lena: Exit.isSuccess(publishFirst.waited) ? publishFirst.waited.value : [],
          choiceFirst: [outcome(choiceFirst.held), outcome(choiceFirst.waited)],
          tom: Exit.isSuccess(choiceFirst.held) ? choiceFirst.held.value : [],
          courses: [
            (yield* SchoolTesting.memberships("lena-fluss")).length,
            (yield* SchoolTesting.memberships("tom-fluss")).length,
          ],
        }).toEqual({
          publishFirst: ["done", "done"],
          lena: ["Applied"],
          choiceFirst: ["done", "done"],
          tom: ["Applied"],
          // The school, the notebook, and both courses.
          courses: [4, 4],
        });
      }),
    );

    it.effect("a publish that creates a course space finishes next to an account deletion", () =>
      Effect.gen(function* () {
        yield* Schools.publish(schoolWith("am-berg", ["ma-1"]), keepAll);
        const lena = yield* admitted("lena-berg", "am-berg");
        yield* Access.enroll(lena, {
          termId: term,
          gradeLevel: 11,
          courseIds: [Course.Id.make("ma-1")],
        });
        const tom = yield* admitted("tom-berg", "am-berg");
        yield* Access.enroll(tom, {
          termId: term,
          gradeLevel: 11,
          courseIds: [Course.Id.make("ma-1")],
        });

        // The publish holds its locks while Lena's deletion waits.
        const publishFirst = yield* interleave(
          publishLocks("am-berg"),
          Schools.publish(schoolWith("am-berg", ["ma-1", "ph-1"]), keepAll),
          Deletion.run("lena-berg"),
        );

        // Tom's deletion holds what it deleted while a publish waits.
        const deletionFirst = yield* interleave(
          Deletion.run("tom-berg"),
          Effect.void,
          Schools.publish(schoolWith("am-berg", ["ma-1", "ph-1", "ch-1"]), keepAll),
        );

        expect({
          publishFirst: [outcome(publishFirst.held), outcome(publishFirst.waited)],
          deletionFirst: [outcome(deletionFirst.held), outcome(deletionFirst.waited)],
          left: [
            ...(yield* SchoolTesting.memberships("lena-berg")),
            ...(yield* SchoolTesting.memberships("tom-berg")),
          ],
          courses: (yield* versions("am-berg")).filter(({ id }) => id.startsWith("course-")).length,
        }).toEqual({
          publishFirst: ["done", "done"],
          deletionFirst: ["done", "done"],
          left: [],
          courses: 3,
        });
      }),
    );

    it.effect(
      "createMany regrants the school once, and a notebook that chose a course reads it",
      () =>
        Effect.gen(function* () {
          const spaces = yield* Spaces.Service;
          const writer = yield* SyncWriter.Service;
          const courses = Array.from({ length: 12 }, (_, index) => `c-${index + 1}`);
          // The school offers the courses, whose spaces don't exist yet.
          yield* Schools.publish(schoolWith("am-wald", []), keepAll);

          yield* writer.reconcile(
            "am-wald",
            CourseOffering.Row,
            yield* Effect.forEach(courses, (courseId) =>
              Effect.map(
                decodeOffering({
                  courseId,
                  termId: term,
                  gradeLevels: [11],
                  classIds: [],
                }),
                (row) => ({ id: `${courseId}@${term}`, row }),
              ),
            ),
          );

          const lena = yield* admitted("lena-wald", "am-wald");
          yield* Access.enroll(lena, {
            termId: term,
            gradeLevel: 11,
            courseIds: [Course.Id.make("c-7")],
          });
          const before = yield* SchoolTesting.memberships("lena-wald");

          const regrants = yield* Ref.make(0);

          yield* spaces
            .createMany(
              Course.Space,
              "am-wald",
              yield* Effect.forEach(courses, (key) =>
                Effect.map(Schools.courseSpace(School.Id.make("am-wald"), key), (id) => ({
                  id,
                  key,
                })),
              ),
            )
            .pipe(
              Effect.provideService(Statement.CurrentTransformer, (statement) =>
                /join space_member p on/u.test(statement.compile()[0])
                  ? Effect.as(
                      Ref.update(regrants, (count) => count + 1),
                      statement,
                    )
                  : Effect.succeed(statement),
              ),
            );

          const course7 = yield* Schools.courseSpace(School.Id.make("am-wald"), "c-7");

          expect({
            before: before.some((line) => line.includes(course7)),
            after: (yield* SchoolTesting.memberships("lena-wald")).includes(
              `course ${course7} reader`,
            ),
            regrants: yield* Ref.get(regrants),
          }).toEqual({ before: false, after: true, regrants: 1 });
        }),
    );
  });
});

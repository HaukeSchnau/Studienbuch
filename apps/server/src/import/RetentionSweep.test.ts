import { describe, expect, it, layer } from "@effect/vitest";
import { CivilTime, School, Studienbuch } from "@stu/core";
import { Pull } from "@stu/sync/server";
import { Postgres18 } from "@stu/sync/testing";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";
import { Access } from "../school/Access.ts";
import { SchoolTesting } from "../school/SchoolTesting.ts";
import { Schools } from "../school/Schools.ts";
import { ImportTesting } from "./ImportTesting.ts";
import { Lease } from "./Lease.ts";
import { RetentionSweep } from "./RetentionSweep.ts";
import { SourceStore } from "./source/SourceStore.ts";

const { lessonDays, lessonOps, pullOnce } = SchoolTesting;
const { morning, today } = ImportTesting;

/** 03:00 in Berlin on 15 December, six weeks after `morning`: day 29 for 16 November. */
const slot = DateTime.makeUnsafe("2026-12-15T02:00:00Z");

const subjects = [
  { id: "ma", name: "Mathematik", shortName: "MA" },
  { id: "de", name: "Deutsch", shortName: "DE" },
];

const courses = subjects.map(({ id }) => Schools.simpleCourse(id));

/** The school with a cancelled lesson of each course on each of `days`. */
const dataOf = Effect.fn("RetentionSweepTest.dataOf")(function* (
  school: School.Id,
  days: ReadonlyArray<string>,
) {
  const { data } = yield* Schools.simple({
    id: school,
    school: { name: "Retention", timeZone: School.defaultTimeZone },
    today,
    gradeLevel: 11,
    subjects,
  });

  const lessonsOf = (courseId: string) =>
    Object.fromEntries(
      days.map((date) => [
        `${courseId}-${date}`,
        {
          courseId,
          date,
          start: 8 * 3_600_000,
          end: 9 * 3_600_000,
          teacherIds: [],
          roomIds: [],
          status: "Cancelled" as const,
          change: { kind: "Cancelled" as const, previousTeacherIds: [], previousRoomIds: [] },
        },
      ]),
    );

  return {
    ...data,
    lessons: Object.fromEntries(courses.map((course) => [course, lessonsOf(course)])),
  } satisfies Schools.Data;
});

/** Publishes the school's lessons of 13, 16 and 17 November at `morning`, as an import would. */
const publishNovember = (school: School.Id) =>
  Effect.flatMap(dataOf(school, ["2026-11-13", "2026-11-16", "2026-11-17"]), (data) =>
    Schools.publish(data, Schools.removeMissing(today)),
  ).pipe(ImportTesting.at(morning));

/** The sweep's hourly slot at `at`, on the live clock moved there. */
const sweepAt = (at: DateTime.Utc) => RetentionSweep.sweepDue.pipe(ImportTesting.at(at));

/** A student of the school with its courses, and her phone's first pull. */
const enrolled = Effect.fn("RetentionSweepTest.enrolled")(function* (
  account: string,
  school: School.Id,
) {
  yield* SchoolTesting.account(account);
  const { notebook } = yield* Access.admit(account, school, Option.none());
  const offered = yield* ImportTesting.at(morning)(Schools.offered(school, 11));
  yield* Access.enroll(notebook, Option.getOrThrow(offered));

  return yield* pullOnce(account, []);
});

const cursorsOf = (pulled: Effect.Success<ReturnType<typeof pullOnce>>) =>
  pulled.patches.map(({ space, to }) => ({ space, version: to }));

const keysOn = (ops: ReturnType<typeof lessonOps>, days: ReadonlyArray<string>, tag: string) =>
  ops
    .filter(({ date }) => Option.exists(date, (row) => days.includes(row.date)))
    .map(({ key }) => `${key} ${tag}`)
    .sort();

/** A day's read of one class's timetable, as a run stores it. */
const dayRead = (day: string) => ({ path: "10/entries/CLASS/111", day, body: { days: [] } });

describe.skipIf(Postgres18.socket === null)("RetentionSweep on PostgreSQL 18", () => {
  // The live clock, moved to each slot (`ImportTesting.at`).
  layer(Pull.layer(Studienbuch.schema.contract).pipe(Layer.provideMerge(SchoolTesting.database)), {
    excludeTestServices: true,
  })((it) => {
    it.effect(
      "with the import paused for six weeks, deletes day 29, keeps day 28, and prunes reads past 35 days",
      () =>
        Effect.gen(function* () {
          const school = School.Id.make("sweep-paused");
          const sql = yield* SqlClient.SqlClient;
          yield* publishNovember(school);
          yield* ImportTesting.at(morning)(Lease.pause(school, "retention-test"));
          // 36 and 34 days before the slot.
          const old = DateTime.makeUnsafe("2026-11-09T05:00:00Z");
          const recent = DateTime.makeUnsafe("2026-11-11T05:00:00Z");
          yield* SourceStore.write(school, old, [dayRead("2026-11-09")]);
          yield* SourceStore.write(school, recent, [dayRead("2026-11-11")]);

          yield* sweepAt(slot);

          const stored = yield* sql<{ readonly day: string }>`
            select day from source_version where school_id = ${school} order by day
          `;

          const claim = yield* Effect.flip(ImportTesting.at(slot)(Lease.claim(school)));

          const recorded = yield* sql<{
            readonly lessons: number | null;
            readonly checkpoint: number | null;
            readonly versions: number | null;
            readonly failure: string | null;
          }>`
            select lessons, checkpoint, versions, failure from retention_sweep
            where school_id = ${school}
          `;

          expect({
            days: yield* lessonDays(school),
            stored: stored.map(({ day }) => day),
            claim: claim._tag,
            recorded,
          }).toEqual({
            days: ["2026-11-17"],
            stored: ["2026-11-11"],
            claim: "Lease.Paused",
            // Two courses on 13 and 16 November; the paused import never wrote a checkpoint.
            recorded: [{ lessons: 4, checkpoint: 0, versions: 1, failure: null }],
          });
        }),
    );

    it.effect("for a school whose import was never set up, deletes day 29 and keeps day 28", () =>
      Effect.gen(function* () {
        const school = School.Id.make("sweep-unset");
        const sql = yield* SqlClient.SqlClient;
        yield* publishNovember(school);
        yield* sweepAt(slot);

        const imports = yield* sql<{ readonly id: string }>`
          select school_id as id from import_school where school_id = ${school}
        `;

        expect({ days: yield* lessonDays(school), imports }).toEqual({
          days: ["2026-11-17"],
          imports: [],
        });
      }),
    );

    it.effect("after a restart across 03:00, the next slot sweeps, and only once that day", () =>
      Effect.gen(function* () {
        const school = School.Id.make("sweep-restart");
        const sql = yield* SqlClient.SqlClient;
        yield* publishNovember(school);
        // 02:00 in Berlin; the server is down for the slots at 03:00 and 04:00.
        yield* sweepAt(DateTime.subtract(slot, { hours: 1 }));
        const early = yield* lessonDays(school);
        const late = DateTime.add(slot, { hours: 2 });
        yield* sweepAt(late);
        yield* sweepAt(DateTime.add(slot, { hours: 3 }));

        const [row] = yield* sql<{ readonly sweptAt: Date }>`
          select swept_at as "sweptAt" from retention_sweep where school_id = ${school}
        `;

        expect({
          early,
          days: yield* lessonDays(school),
          once:
            row !== undefined &&
            Math.abs(row.sweptAt.getTime() - DateTime.toEpochMillis(late)) < 60_000,
        }).toEqual({
          early: ["2026-11-13", "2026-11-16", "2026-11-17"],
          days: ["2026-11-17"],
          once: true,
        });
      }),
    );

    it.effect("waits for a publish that holds the school, and the two leave one history", () =>
      Effect.gen(function* () {
        const school = School.Id.make("sweep-race");
        const sql = yield* SqlClient.SqlClient;
        yield* publishNovember(school);
        const first = yield* enrolled("lena-race", school);
        const held = yield* Deferred.make<void>();
        const go = yield* Deferred.make<void>();

        // The next publish adds 16 and 17 December and removes nothing itself.
        const next = yield* dataOf(school, ["2026-12-16", "2026-12-17"]);
        const keepsAll = { today, lesson: () => false, closureDates: () => [] };

        const publish = yield* Effect.forkChild(
          sql.withTransaction(
            Effect.gen(function* () {
              yield* Schools.holdSpaces(school, "update");
              yield* Deferred.succeed(held, undefined);
              yield* Deferred.await(go);
              yield* Schools.publish(next, keepsAll);
            }),
          ),
        );

        yield* Deferred.await(held);
        const sweep = yield* Effect.forkChild(sweepAt(slot));

        // The sweep runs to its end, or waits for the school the publish holds.
        yield* Effect.raceFirst(
          Effect.asVoid(Fiber.await(sweep)),
          sql<{ readonly waiting: number }>`
            select count(*)::int as waiting from pg_stat_activity
            where datname = current_database() and wait_event_type = 'Lock'
          `.pipe(Effect.repeat({ until: ([row]) => (row?.waiting ?? 0) > 0 }), Effect.asVoid),
        );

        const waited = sweep.pollUnsafe() === undefined;
        yield* Deferred.succeed(go, undefined);
        yield* Fiber.join(publish);
        yield* Fiber.join(sweep);

        const later = lessonOps(yield* pullOnce("lena-race", cursorsOf(first)));
        const fresh = lessonOps(yield* pullOnce("lena-race", []));

        // Each course space's version is its newest row's, and the publish's rows come before
        // the sweep's tombstones.
        const spaces = yield* sql<{ readonly consistent: boolean }>`
          select s.version = max(r.version)
            and max(r.version) filter (where r.data is not null and r.data->>'date' >= '2026-12-16')
              < min(r.version) filter (where r.data is null) as consistent
          from space s join sync_row r on r.space_id = s.id and r.tbl = 'Lesson'
          where s.parent_id = ${school}
          group by s.id, s.version
        `;

        expect({
          waited,
          days: yield* lessonDays(school),
          later: later.map(({ key, tag }) => `${key} ${tag}`).sort(),
          fresh: fresh.map(({ key, tag }) => `${key} ${tag}`).sort(),
          spaces: spaces.map(({ consistent }) => consistent),
        }).toEqual({
          waited: true,
          days: ["2026-11-17", "2026-12-16", "2026-12-17"],
          later: [
            ...keysOn(lessonOps(first), ["2026-11-13", "2026-11-16"], "Deleted"),
            ...keysOn(fresh, ["2026-12-16", "2026-12-17"], "Readable"),
          ].sort(),
          fresh: keysOn(fresh, ["2026-11-17", "2026-12-16", "2026-12-17"], "Readable"),
          spaces: [true, true],
        });
      }),
    );

    it.effect(
      "a device offline through six weeks of daily sweeps gets exactly their tombstones",
      () =>
        Effect.gen(function* () {
          const school = School.Id.make("sweep-offline");
          yield* publishNovember(school);
          yield* ImportTesting.at(morning)(Lease.pause(school, "retention-test"));
          const first = yield* enrolled("lena-sweeps", school);

          // Every day's slot from 3 November to 15 December, all in winter time.
          for (let day = 0; day <= 42; day++) {
            yield* sweepAt(DateTime.add(slot, { days: day - 42 }));
          }

          const later = lessonOps(yield* pullOnce("lena-sweeps", cursorsOf(first)));
          const held = lessonOps(first);

          expect({
            held: keysOn(held, ["2026-11-13", "2026-11-16", "2026-11-17"], "Readable").length,
            later: later.map(({ key, tag }) => `${key} ${tag}`).sort(),
          }).toEqual({
            held: 6,
            later: keysOn(held, ["2026-11-13", "2026-11-16"], "Deleted"),
          });
        }),
    );
  });
});

describe("RetentionSweep", () => {
  // Germany's clocks change at 01:00 UTC, so 03:00 in Berlin moves from 02:00 UTC to 01:00 and
  // back. Athens's change at 01:00 UTC skips its 03:00 in March and repeats it in October.
  it.each([
    { zone: "Europe/Berlin", day: "2026-03-28", sweeps: "2026-03-28T02:00:00.000Z" },
    { zone: "Europe/Berlin", day: "2026-03-29", sweeps: "2026-03-29T01:00:00.000Z" },
    { zone: "Europe/Berlin", day: "2026-10-24", sweeps: "2026-10-24T01:00:00.000Z" },
    { zone: "Europe/Berlin", day: "2026-10-25", sweeps: "2026-10-25T02:00:00.000Z" },
    { zone: "Europe/Athens", day: "2026-03-29", sweeps: "2026-03-29T01:00:00.000Z" },
    { zone: "Europe/Athens", day: "2026-10-25", sweeps: "2026-10-25T00:00:00.000Z" },
  ])("on $day in $zone, one hourly slot sweeps", ({ zone, day, sweeps }) => {
    const row = { name: "Retention", timeZone: CivilTime.TimeZone.make(zone) };
    const midnight = DateTime.makeUnsafe(`${day}T00:00:00Z`);
    const dateAt = (at: DateTime.Utc) => School.today(row, DateTime.toEpochMillis(at));
    // The day before's sweep, at noon UTC.
    let last = Option.some(dateAt(DateTime.subtract(midnight, { hours: 12 })));
    const swept: Array<string> = [];

    for (let hour = 0; hour < 24; hour++) {
      const at = DateTime.add(midnight, { hours: hour });

      if (RetentionSweep.due(Option.some(row), at, last)) {
        swept.push(DateTime.formatIso(at));
        last = Option.some(dateAt(at));
      }
    }

    expect(swept).toEqual([sweeps]);
  });
});

import { TransportError, WebUntisClient } from "@schnau/webuntis-api";
import { assert, describe, expect, it, layer } from "@effect/vitest";
import { CivilTime, Enrollment, School, Studienbuch } from "@stu/core";
import type { Protocol } from "@stu/sync";
import { Pull, SyncWriter } from "@stu/sync/server";
import { Postgres18 } from "@stu/sync/testing";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Struct from "effect/Struct";
import * as TestClock from "effect/testing/TestClock";
import { DatabaseTesting } from "../infra/database/DatabaseTesting.ts";
import { RecordedWebUntis } from "../infra/webuntis/RecordedWebUntis.ts";
import { Access } from "../school/Access.ts";
import { SchoolTesting } from "../school/SchoolTesting.ts";
import { Schools } from "../school/Schools.ts";
import type { Corpus } from "./corpus/Corpus.ts";
import { NamedSchoolTesting } from "./corpus/NamedSchoolTesting.ts";
import { Evaluator } from "./evaluation/Evaluator.ts";
import { TinySchool } from "./evaluation/TinySchool.ts";
import { ImportIds } from "./ImportIds.ts";
import { ImportRun } from "./ImportRun.ts";
import { ImportTesting } from "./ImportTesting.ts";
import { Lease } from "./Lease.ts";
import { NaiveImport } from "./NaiveImport.ts";
import { SelfCheck } from "./SelfCheck.ts";
import { SourceStore } from "./source/SourceStore.ts";

const { dayOf, firstEntryOn, list, object, planted } = NamedSchoolTesting;
const { morning } = ImportTesting;
const entriesOf = (resource: number) => RecordedWebUntis.paths.entries(10, "CLASS", resource);
const minutesAfter = (minutes: number) => DateTime.add(morning, { minutes });

type Client = WebUntisClient["Service"];

type Batch = Client["timetable"]["getEntriesForResources"];

/**
 * A connection that answers from the recording as WebUntis did on the morning of 2 November. It
 * sends no request, so it has none for the gate.
 */
const recorded =
  (corpus: Corpus.Corpus, change: (client: Client) => Client = (client) => client) =>
  () =>
    Layer.effect(WebUntisClient)(
      Effect.map(RecordedWebUntis.make(corpus.reads, { asOf: morning }), ({ client }) =>
        change(client),
      ),
    );

const withBatch =
  (batch: (client: Client) => Batch) =>
  (client: Client): Client => ({
    ...client,
    timetable: { ...client.timetable, getEntriesForResources: batch(client) },
  });

/** Every class view's read says it started, then waits for `release`. */
const held = (reading: Deferred.Deferred<void>, release: Deferred.Deferred<void>) =>
  withBatch(
    (client) => (input, batchOptions) =>
      Deferred.succeed(reading, undefined).pipe(
        Effect.andThen(Deferred.await(release)),
        Effect.andThen(client.timetable.getEntriesForResources(input, batchOptions)),
      ),
  );

/** The view of `12` fails, as one resource of a batch can. */
const failingTwelve = withBatch(
  (client) => (input, batchOptions) =>
    input.resources.includes(112)
      ? Effect.succeed([
          {
            resource: 112,
            result: Result.fail(
              new TransportError({ method: "GET", path: "timetable", message: "unavailable" }),
            ),
          },
        ])
      : client.timetable.getEntriesForResources(input, batchOptions),
);

/** The view of `12` answers without days and with WebUntis's error, as a partial answer can. */
const erringTwelve = withBatch(
  (client) => (input, batchOptions) =>
    input.resources.includes(112)
      ? Effect.succeed([
          {
            resource: 112,
            raw: { format: 2, days: [], errors: [{ code: "PARTIAL" }] },
            result: Result.succeed({ format: 2, days: [], errors: [{ code: "PARTIAL" }] }),
          },
        ])
      : client.timetable.getEntriesForResources(input, batchOptions),
);

/** The view of the student `S1` fails, as one resource of a batch can. */
const failingStudent = withBatch(
  (client) => (input, batchOptions) =>
    input.resourceType === "STUDENT" && input.resources.includes(501)
      ? Effect.succeed([
          {
            resource: 501,
            result: Result.fail(
              new TransportError({ method: "GET", path: "timetable", message: "unavailable" }),
            ),
          },
        ])
      : client.timetable.getEntriesForResources(input, batchOptions),
);

/** The students' directory dies, as a defect after the publish would. */
const dyingDirectory = (client: Client): Client => ({
  ...client,
  timetable: {
    ...client.timetable,
    getFilter: (input) =>
      input.resourceType === "STUDENT" ? Effect.die("broken") : client.timetable.getFilter(input),
  },
});

/** The students' directory without its last student, which only the nightly self-check reads. */
const shorterDirectory = (client: Client): Client => ({
  ...client,
  timetable: {
    ...client.timetable,
    getFilter: (input) =>
      input.resourceType === "STUDENT"
        ? Effect.map(client.timetable.getFilter(input), (filter) => ({
            ...filter,
            students: filter.students.slice(0, -1),
          }))
        : client.timetable.getFilter(input),
  },
});

/** TinySchool with its term opening on Monday of 2026-W45, the day of the runs' first window. */
const openingOnW45: Corpus.Corpus = {
  ...TinySchool.corpus,
  cases: {
    ...TinySchool.corpus.cases,
    terms: [{ id: "after-break", start: "2026-11-02", end: "2027-01-31" }],
  },
};

const options = (
  school: string,
  overrides: Partial<ImportRun.Options> = {},
): ImportRun.Options => ({
  profile: { ...TinySchool.profile, id: School.Id.make(school), publish: true },
  nightly: true,
  maximum: 350,
  source: recorded(TinySchool.corpus),
  ...overrides,
});

const runAt = (instant: DateTime.Utc, run: ImportRun.Options) =>
  ImportRun.run(run).pipe(ImportTesting.at(instant));

/** Tables a run wrote or removed rows of, with their counts. */
const changed = (ran: ImportRun.Ran) =>
  Object.fromEntries(
    Object.entries(ran.report.rows).filter(([, { written, removed }]) => written + removed > 0),
  );

/** Every row of the school's spaces, as `<space> <table> <id> <data>`. */
const published = (school: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly line: string }>`
      select r.space_id || ' ' || r.tbl || ' ' || r.id || ' ' || coalesce(r.data::text, '-') as line
      from sync_row r join space s on s.id = r.space_id
      where s.id = ${school} or s.parent_id = ${school}
      order by line
    `,
  ).pipe(Effect.map((rows) => rows.map(({ line }) => line)));

const idsOf = (school: string, table: "Lesson" | "Closure") =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly id: string }>`
      select r.id from sync_row r join space s on s.id = r.space_id
      where (s.id = ${school} or s.parent_id = ${school}) and r.tbl = ${table}
        and r.data is not null
    `,
  ).pipe(Effect.map((rows) => new Set(rows.map(({ id }) => id))));

const checkpoint = (school: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{
      readonly revision: number;
      readonly previous: string;
      readonly pending: string;
    }>`
      select revision, coalesce(previous::text, '') as previous, pending::text as pending
      from import_school where school_id = ${school}
    `,
  ).pipe(Effect.map(([row]) => row));

const decodeSelfCheck = Schema.decodeUnknownEffect(Schema.fromJsonString(SelfCheck.Result));

/** The school's self-checks, run by run. */
const selfChecks = (school: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly selfCheck: string }>`
      select self_check::text as "selfCheck" from import_run
      where school_id = ${school} and self_check is not null order by started_at, id
    `,
  ).pipe(
    Effect.flatMap((rows) => Effect.forEach(rows, ({ selfCheck }) => decodeSelfCheck(selfCheck))),
  );

const outcomes = (school: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly outcome: string | null; readonly sent: number }>`
      select outcome, sent from import_run where school_id = ${school} order by started_at, id
    `,
  );

/** The first lesson of `DE` in `11.1` on Monday of 2026-W46. */
const mondayDe = (school: string) =>
  ImportIds.lesson(
    School.Id.make(school),
    ImportIds.course(School.Id.make(school), "DE/11.1"),
    "2026-11-09",
    8 * 3_600_000,
  );

/** `11.1`'s view without its first entry of 9 November. */
const withoutMondayDe = planted(TinySchool.corpus, entriesOf(111), (body) => {
  const day = dayOf(body, "2026-11-09");

  day.gridEntries = list(day.gridEntries).slice(1);
});

/** `11.1`'s first entry of 9 November in the day's last block. */
const movedMondayDe = planted(TinySchool.corpus, entriesOf(111), (body) => {
  firstEntryOn(body, "2026-11-09").duration = {
    start: "2026-11-09T15:15",
    end: "2026-11-09T16:35",
  };
});

/** The recording answering until January's end, without lessons after November, for later runs. */
const throughJanuary = (corpus: Corpus.Corpus): Corpus.Corpus => ({
  ...corpus,
  reads: new Map(
    [...corpus.reads].map(([path, read]) => [
      path,
      {
        versions: read.versions.map((version) =>
          version.end === "2026-11-29" ? { ...version, end: "2027-01-31" } : version,
        ),
      },
    ]),
  ),
});

/** The days of the school's published lessons, in order. */
const lessonDays = (school: string) =>
  Effect.flatMap(
    SqlClient.SqlClient,
    (sql) => sql<{ readonly date: string }>`
      select distinct r.data->>'date' as date from sync_row r join space s on s.id = r.space_id
      where s.parent_id = ${school} and r.tbl = 'Lesson' and r.data is not null
      order by date
    `,
  ).pipe(Effect.map((rows) => rows.map(({ date }) => date)));

const decodeDated = Schema.decodeUnknownOption(Schema.Struct({ date: Schema.String }));

/** One pull of the account's phone from `cursors`, which must fit on one page. */
const pullOnce = (account: string, cursors: ReadonlyArray<typeof Protocol.Cursor.Type>) =>
  Effect.flatMap(Pull.Service, (service) =>
    service.pull(account, {
      clientId: `${account}-phone`,
      syncEpoch: null,
      contract: Studienbuch.schema.contract,
      cursors,
      settledMutationId: 0,
      limit: 1000,
    }),
  ).pipe(Effect.tap((response) => Effect.sync(() => assert.isFalse(response.more))));

const bridgeDay = {
  id: 3,
  name: "Brückentag",
  start: "2026-11-20",
  end: "2026-11-20",
  bookable: false,
};

const withBridgeDay = planted(TinySchool.corpus, RecordedWebUntis.paths.appData, (body) => {
  body.holidays = [...list(body.holidays), bridgeDay];
});

describe.skipIf(Postgres18.socket === null)("ImportRun on PostgreSQL 18", () => {
  // The live clock, moved to the invented school's dates for each run (`ImportTesting.at`).
  layer(Pull.layer(Studienbuch.schema.contract).pipe(Layer.provideMerge(SchoolTesting.database)), {
    excludeTestServices: true,
  })((it) => {
    it.effect(
      "publishes a snapshot, and the same snapshot again writes only the Stand's step",
      () =>
        Effect.gen(function* () {
          const first = yield* runAt(morning, options("tiny-first"));
          const again = yield* runAt(minutesAfter(10), options("tiny-first"));
          const later = yield* runAt(minutesAfter(31), options("tiny-first"));
          const status = yield* Schools.importStatus(School.Id.make("tiny-first"));

          expect({
            first: [first.outcome, first.report.rows.Lesson?.written, first.report.unplanned],
            again: changed(again),
            later: changed(later),
            runs: yield* outcomes("tiny-first"),
            status: Option.map(status, ({ observedAt, coveredUntil }) => [
              DateTime.formatIso(observedAt).slice(0, 16),
              CivilTime.format(coveredUntil),
            ]),
          }).toEqual({
            // Four weeks of the invented school's lessons, the joint INF lesson once a week, and
            // nothing the plan didn't read.
            first: ["Published", 60, []],
            again: {},
            later: { ImportStatus: { written: 1, removed: 0 } },
            // A recording sends no request; the live connection's runs count theirs.
            runs: [
              { outcome: "Published", sent: 0 },
              { outcome: "Published", sent: 0 },
              { outcome: "Published", sent: 0 },
            ],
            // WebUntis leaves out weekends, so the window's last Sunday counts as covered.
            status: Option.some(["2026-11-02T05:31", "2026-11-29"]),
          });
        }),
    );

    // The harness takes each Kurswahl from 2026-W45 and W46 and scores W47 and W48, as the night's
    // self-check does on its first window in the import's term.
    it.effect(
      "the nightly self-check measures as the harness does, before and after publishing",
      () =>
        Effect.gen(function* () {
          const harness = yield* Evaluator.evaluate({
            corpus: openingOnW45,
            corpusName: "tiny-school",
            profile: TinySchool.profile,
            importName: "naive",
            importLayer: NaiveImport.layer,
            weeks: Option.none(),
            timeline: false,
          });

          const nights = yield* Effect.forEach([false, true], (publish) =>
            Effect.gen(function* () {
              const school = publish ? "tiny-check-live" : "tiny-check-dark";
              const run = options(school, { profile: { ...options(school).profile, publish } });
              const first = yield* runAt(morning, run);
              const again = yield* runAt(minutesAfter(10), run);

              return {
                outcomes: [first.outcome, again.outcome],
                checks: yield* selfChecks(school),
              };
            }),
          );

          const measured = SelfCheck.Result.cases.Measured.make({
            students: 8,
            chosen: 8,
            studentWeeks: harness.views.student,
            kurswahl: harness.kurswahl,
            ghostCourses: harness.ghostCourses,
            courseIdentity: Struct.omit(harness.courseIdentity, ["subjects"]),
            hiddenDays: 0,
          });

          // The second night takes no Kurswahl: it keeps the first night's.
          const checks = [measured, { ...measured, chosen: 0 }];

          assert.isAbove(harness.views.student.weeks.of, 0);

          expect(nights).toEqual([
            { outcomes: ["Dark", "Dark"], checks },
            { outcomes: ["Published", "Published"], checks },
          ]);
        }),
    );

    it.effect.each([
      { name: "a student view fails", change: failingStudent, reason: "TransportError" },
      // A defect after the publish: the publish stands, and the self-check says the run failed.
      { name: "the self-check dies", change: dyingDirectory, reason: "Failed" },
    ])("when $name the self-check is unmeasured and the night's rows stand", ({ change, reason }) =>
      Effect.gen(function* () {
        const school = `tiny-check-${reason}`;
        const sql = yield* SqlClient.SqlClient;

        const ran = yield* runAt(
          morning,
          options(school, { source: recorded(TinySchool.corpus, change) }),
        );

        const [kept] = yield* sql<{ readonly kurswahl: string }>`
          select kurswahl::text as kurswahl from import_school where school_id = ${school}
        `;

        expect({
          outcome: ran.outcome,
          lessons: (yield* idsOf(school, "Lesson")).size,
          checks: yield* selfChecks(school),
          kept: kept?.kurswahl,
        }).toEqual({
          outcome: "Published",
          lessons: 60,
          checks: [SelfCheck.Result.cases.NotMeasured.make({ reason })],
          kept: "[]",
        });
      }),
    );

    it.effect.each([
      { name: "fails", school: "tiny-failing", change: failingTwelve, tag: "TransportError" },
      {
        name: "answers with an error",
        school: "tiny-erring",
        change: erringTwelve,
        tag: "ImportRun.AnsweredWithErrors",
      },
    ])(
      "publishes nothing when one read $name, and the next complete run publishes",
      ({ school, change, tag }) =>
        Effect.gen(function* () {
          const failed = yield* runAt(
            morning,
            options(school, { source: recorded(TinySchool.corpus, change) }),
          );

          const before = { rows: yield* published(school), checkpoint: yield* checkpoint(school) };
          const complete = yield* runAt(minutesAfter(10), options(school));

          expect({
            failed: [failed.outcome, failed.report.failures, failed.report.versionsStored > 0],
            before,
            complete: [complete.outcome, (yield* idsOf(school, "Lesson")).size],
          }).toEqual({
            // The reads that answered are stored: the store is a log.
            failed: ["Incomplete", { [tag]: 1 }, true],
            before: { rows: [], checkpoint: { revision: 0, previous: "", pending: "[]" } },
            complete: ["Published", 60],
          });
        }),
    );

    it.effect.each([
      {
        name: "keeps a lesson one snapshot lacks, and removes it when the next lacks it too",
        school: "tiny-twice",
        snapshots: [TinySchool.corpus, withoutMondayDe, withoutMondayDe],
        present: [true, true, false],
      },
      {
        name: "never removes a lesson that came back between two snapshots that lack it",
        school: "tiny-back",
        snapshots: [TinySchool.corpus, withoutMondayDe, TinySchool.corpus, withoutMondayDe],
        present: [true, true, true, true],
      },
      {
        name: "replaces a lesson whose entry moved to another slot at once",
        school: "tiny-moved",
        snapshots: [TinySchool.corpus, movedMondayDe],
        present: [true, false],
      },
    ])("$name", ({ school, snapshots, present }) =>
      Effect.gen(function* () {
        const seen: Array<boolean> = [];

        for (const [index, snapshot] of snapshots.entries()) {
          const ran = yield* runAt(
            minutesAfter(10 * index),
            options(school, { source: recorded(snapshot) }),
          );

          assert.strictEqual(ran.outcome, "Published");
          seen.push((yield* idsOf(school, "Lesson")).has(mondayDe(school)));
        }

        expect(seen).toEqual(present);
      }),
    );

    it.effect("removes a closure only when two holiday reads in a row lack it", () =>
      Effect.gen(function* () {
        const school = "tiny-bridge";
        const bridge = ImportIds.closure(School.Id.make(school), bridgeDay.id);
        const seen: Array<boolean> = [];

        for (const [index, snapshot] of [
          withBridgeDay,
          TinySchool.corpus,
          TinySchool.corpus,
        ].entries()) {
          yield* runAt(minutesAfter(10 * index), options(school, { source: recorded(snapshot) }));
          seen.push((yield* idsOf(school, "Closure")).has(bridge));
        }

        expect(seen).toEqual([true, true, false]);
      }),
    );

    it.effect("removes every published date of a closure that two holiday reads lack", () =>
      Effect.gen(function* () {
        const school = "tiny-bridge-shrunk";
        const bridge = ImportIds.closure(School.Id.make(school), bridgeDay.id);
        const holidays = RecordedWebUntis.paths.appData;
        const longBridge = { ...bridgeDay, end: "2026-11-22" };

        const long = planted(TinySchool.corpus, holidays, (body) => {
          body.holidays = [...list(body.holidays), longBridge];
        });

        // A day bridge again, from an answer for another school year, which covers no closure.
        const shrunk = planted(TinySchool.corpus, holidays, (body) => {
          body.holidays = [...list(body.holidays), bridgeDay];
          object(body.currentSchoolYear).id = 11;
        });

        const seen: Array<boolean> = [];

        for (const [index, snapshot] of [
          long,
          shrunk,
          TinySchool.corpus,
          TinySchool.corpus,
        ].entries()) {
          yield* runAt(minutesAfter(10 * index), options(school, { source: recorded(snapshot) }));
          seen.push((yield* idsOf(school, "Closure")).has(bridge));
        }

        expect(seen).toEqual([true, true, true, false]);
      }),
    );

    it.effect("deletes nothing when the directory drops a class for two runs", () =>
      Effect.gen(function* () {
        const school = "tiny-dropped";

        const withoutClass = planted(
          TinySchool.corpus,
          RecordedWebUntis.paths.filter(10, "CLASS"),
          (body) => {
            body.classes = list(body.classes).filter(
              (each) => object(object(each).class).id !== 111,
            );
          },
        );

        yield* runAt(morning, options(school));
        const before = yield* idsOf(school, "Lesson");

        const second = yield* runAt(
          minutesAfter(10),
          options(school, { source: recorded(withoutClass) }),
        );

        const third = yield* runAt(
          minutesAfter(20),
          options(school, { source: recorded(withoutClass) }),
        );

        const after = yield* idsOf(school, "Lesson");

        expect({
          runs: [second.outcome, third.outcome, third.report.unplanned],
          removed: [...before].filter((id) => !after.has(id)),
        }).toEqual({ runs: ["Published", "Published", []], removed: [] });
      }),
    );

    it.effect("a daytime run on a re-planned week creates no course and keeps every choice", () =>
      Effect.gen(function* () {
        const school = School.Id.make("tiny-replanned");
        const writer = yield* SyncWriter.Service;

        // `11.1`'s Monday `DE` of W46 becomes an `MA-E` group no nightly run has seen.
        const replanned = planted(TinySchool.corpus, entriesOf(111), (body) => {
          const subject = object(
            object(list(firstEntryOn(body, "2026-11-09").position2)[0]).current,
          );

          subject.shortName = "MA-E";
          subject.longName = "Mathematik E";
          subject.displayName = "Mathematik E";
        });

        yield* runAt(morning, options(school));
        yield* SchoolTesting.account("lena-replanned");
        const { notebook } = yield* Access.admit("lena-replanned", school, Option.none());
        const choice = Option.getOrThrow(yield* Schools.offered(school, 11));
        yield* Access.enroll(notebook, choice);

        const daytime = yield* runAt(
          minutesAfter(60),
          options(school, { nightly: false, source: recorded(replanned) }),
        );

        const kept = yield* Effect.exit(
          writer.write(
            notebook,
            Enrollment.set.writes,
            Enrollment.set.run({ notebook, ...choice }),
          ),
        );

        const status = yield* Schools.importStatus(school);

        expect({
          daytime: [daytime.outcome, daytime.report.unattributed],
          courses: [
            daytime.report.rows.Course?.written,
            daytime.report.rows.CourseOffering?.written,
          ],
          choice: choice.courseIds.length,
          kept: Exit.isSuccess(kept),
          coveredUntil: Option.map(status, ({ coveredUntil }) => CivilTime.format(coveredUntil)),
        }).toEqual({
          daytime: ["Published", 1],
          courses: [0, 0],
          choice: 6,
          kept: true,
          // The daytime run covers nothing past the day it couldn't attribute an entry of, and
          // the days the nightly run covered still stand.
          coveredUntil: Option.some("2026-11-29"),
        });
      }),
    );

    it.effect(
      "a crash inside the publish leaves rows, previous and the checkpoint as they were",
      () =>
        Effect.gen(function* () {
          const school = "tiny-crash";
          yield* runAt(morning, options(school));
          const before = { rows: yield* published(school), checkpoint: yield* checkpoint(school) };
          const writer = yield* SyncWriter.Service;

          const crashing = SyncWriter.Service.of({
            ...writer,
            reconcile: (space, table, rows, reconcileOptions) =>
              table.name === "Lesson"
                ? Effect.die("a crash in the middle of a publish")
                : writer.reconcile(space, table, rows, reconcileOptions),
          });

          const crashed = yield* runAt(
            minutesAfter(40),
            options(school, { source: recorded(movedMondayDe) }),
          ).pipe(Effect.provideService(SyncWriter.Service, crashing));

          expect({
            crashed: [crashed.outcome, crashed.report.failure],
            after: { rows: yield* published(school), checkpoint: yield* checkpoint(school) },
            runs: (yield* outcomes(school)).map(({ outcome }) => outcome),
          }).toEqual({
            crashed: ["Failed", "Defect"],
            after: before,
            runs: ["Published", "Failed"],
          });
        }),
    );

    it.effect("a run that another checkpoint landed before rolls back", () =>
      Effect.gen(function* () {
        const school = "tiny-superseded";
        const sql = yield* SqlClient.SqlClient;
        yield* runAt(morning, options(school));
        const rows = yield* published(school);
        const reading = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();

        const run = yield* Effect.forkChild(
          runAt(
            minutesAfter(40),
            options(school, { source: recorded(movedMondayDe, held(reading, release)) }),
          ),
        );

        yield* Deferred.await(reading);
        // As a run would whose lease passed while this one read.
        yield* sql`update import_school set revision = revision + 1 where school_id = ${school}`;
        yield* Deferred.succeed(release, undefined);
        const ran = yield* Fiber.join(run);

        expect({
          outcome: ran.outcome,
          rows: yield* published(school),
          revision: (yield* checkpoint(school))?.revision,
        }).toEqual({ outcome: "Superseded", rows, revision: 2 });
      }),
    );

    it.effect("a run whose reservation waits past its lease reads nothing and times out", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const school = School.Id.make("tiny-late");
        const holding = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
        const connected = yield* Ref.make(false);

        // Another reservation keeps the budget's lock, as a slow commit would.
        const other = yield* Effect.forkChild(
          sql.withTransaction(
            ImportRun.reserve({
              school,
              date: ImportTesting.today,
              nightly: false,
              maximum: 1,
              startedAt: morning,
            }).pipe(
              Effect.tap(() => Deferred.succeed(holding, undefined)),
              Effect.tap(() => Deferred.await(release)),
            ),
          ),
        );

        yield* Deferred.await(holding);
        const clock = yield* TestClock.make();

        const source = () =>
          Layer.effect(WebUntisClient)(
            Effect.andThen(Ref.set(connected, true), Effect.die("a connection")),
          );

        const run = yield* Effect.forkChild(
          ImportRun.run(options(school, { source })).pipe(
            ImportTesting.at(morning),
            Effect.provideService(Clock.Clock, clock),
          ),
        );

        yield* DatabaseTesting.someoneWaits;
        yield* clock.adjust("6 minutes");
        yield* Deferred.succeed(release, undefined);
        yield* Fiber.join(other);
        const ran = yield* Fiber.join(run);

        const rows = yield* sql<{ readonly outcome: string | null; readonly sent: number }>`
          select outcome, sent from import_run
          where id = ${Option.getOrElse(ran.run, () => "")}::uuid
        `;

        expect({ outcome: ran.outcome, rows, connected: yield* Ref.get(connected) }).toEqual({
          outcome: "TimedOut",
          rows: [{ outcome: "TimedOut", sent: 0 }],
          connected: false,
        });
      }),
    );

    it.effect("a pause waits for the run that reads, and no run starts after it", () =>
      Effect.gen(function* () {
        const school = School.Id.make("tiny-paused");
        const reading = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();

        const run = yield* Effect.forkChild(
          runAt(
            morning,
            options(school, { source: recorded(TinySchool.corpus, held(reading, release)) }),
          ),
        );

        yield* Deferred.await(reading);

        // The pause looks at the lease every second of a clock of its own, which the test moves.
        const clock = yield* TestClock.make();

        const pause = yield* Effect.forkChild(
          Lease.pause(school, "live-test-a").pipe(Effect.provideService(Clock.Clock, clock)),
        );

        const leased = Lease.drained(school).pipe(
          Effect.map((drained) => !drained),
          ImportTesting.at(minutesAfter(1)),
        );

        const waiting: Array<boolean> = [];

        for (let look = 0; look < 3; look++) {
          yield* clock.adjust("1 second");
          waiting.push((yield* leased) && pause.pollUnsafe() === undefined);
        }

        yield* Deferred.succeed(release, undefined);
        const ran = yield* Fiber.join(run);

        // Its next look finds the lease gone.
        while (pause.pollUnsafe() === undefined) {
          yield* clock.adjust("1 second");
          yield* leased;
        }

        yield* Fiber.join(pause);
        const after = yield* runAt(minutesAfter(10), options(school));
        const second = yield* Effect.flip(Lease.pause(school, "live-test-b"));
        const other = yield* Effect.flip(Lease.resume(school, "live-test-b"));
        yield* Lease.resume(school, "live-test-a");
        const resumed = yield* runAt(minutesAfter(20), options(school));

        expect({
          waiting,
          ran: ran.outcome,
          after: after.outcome,
          second: second._tag,
          other: other._tag,
          resumed: resumed.outcome,
        }).toEqual({
          waiting: [true, true, true],
          ran: "Published",
          after: "Paused",
          second: "Lease.PausedByOther",
          other: "Lease.NotPausedBy",
          resumed: "Published",
        });
      }),
    );

    it.effect("a pause its owner resumed while it waited fails", () =>
      Effect.gen(function* () {
        const school = School.Id.make("tiny-resumed");
        const reading = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();

        const run = yield* Effect.forkChild(
          runAt(
            morning,
            options(school, { source: recorded(TinySchool.corpus, held(reading, release)) }),
          ),
        );

        yield* Deferred.await(reading);
        const clock = yield* TestClock.make();

        const pause = yield* Effect.forkChild(
          Effect.flip(
            Lease.pause(school, "live-test-a").pipe(Effect.provideService(Clock.Clock, clock)),
          ),
        );

        const leased = Lease.drained(school).pipe(ImportTesting.at(minutesAfter(1)));

        // The pause is written before it waits, so the resume finds it.
        while (
          yield* Lease.resume(school, "live-test-a").pipe(
            Effect.as(false),
            Effect.orElseSucceed(() => true),
          )
        ) {
          yield* leased;
        }

        yield* Deferred.succeed(release, undefined);
        yield* Fiber.join(run);

        while (pause.pollUnsafe() === undefined) {
          yield* clock.adjust("1 second");
          yield* leased;
        }

        expect((yield* Fiber.join(pause))._tag).toBe("Lease.NotPausedBy");
      }),
    );

    it.effect("clears a lease only for the claim that took it", () =>
      Effect.gen(function* () {
        const school = School.Id.make("tiny-lease");
        const first = yield* Lease.claim(school);
        yield* Lease.release(school, "00000000-0000-4000-8000-000000000000");
        const busy = yield* Effect.flip(Lease.claim(school));
        yield* Lease.release(school, first.owner);
        const second = yield* Lease.claim(school);

        expect([busy._tag, second.owner === first.owner]).toEqual(["Lease.Busy", false]);
      }),
    );

    it.effect("two reservations racing for the day's last requests can't both pass", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const school = School.Id.make("tiny-budget");

        const reserve = (maximum: number) =>
          ImportRun.reserve({
            school,
            date: ImportTesting.today,
            nightly: false,
            maximum,
            startedAt: morning,
          });

        yield* reserve(ImportRun.dailyCap - 26);
        const holding = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();

        // The first keeps its transaction open after its reservation, as a slow commit would.
        const first = yield* Effect.forkChild(
          sql.withTransaction(
            reserve(26).pipe(
              Effect.tap(() => Deferred.succeed(holding, undefined)),
              Effect.tap(() => Deferred.await(release)),
            ),
          ),
        );

        yield* Deferred.await(holding);
        const second = yield* Effect.forkChild(reserve(26));

        // Without the budget's lock the second runs through, and the check fails on `blocked`.
        const blocked = yield* Effect.raceFirst(
          Effect.as(DatabaseTesting.someoneWaits, true),
          Effect.as(Fiber.await(second), false),
        );

        yield* Deferred.succeed(release, undefined);

        expect({
          blocked,
          first: (yield* Fiber.join(first)).fits,
          second: (yield* Fiber.join(second)).fits,
          over: (yield* runAt(morning, options(school, { maximum: 1 }))).outcome,
        }).toEqual({ blocked: true, first: true, second: false, over: "OverBudget" });
      }),
    );

    it.effect("stores no student's name or unknown field, and the stored reads import alike", () =>
      Effect.gen(function* () {
        const school = School.Id.make("tiny-stored");
        const sql = yield* SqlClient.SqlClient;

        const student = {
          type: "STUDENT",
          status: "REGULAR",
          shortName: "S1",
          longName: "Schüler 1",
          displayName: "Schüler 1",
          displayNameLabel: "Schüler 1",
        };

        // A student in the class directory and in a lesson's position, and a field without a rule.
        const named = planted(
          planted(TinySchool.corpus, RecordedWebUntis.paths.filter(10, "CLASS"), (body) => {
            body.students = [
              {
                student: {
                  id: 509,
                  shortName: "S9",
                  longName: "Schüler 9",
                  displayName: "Schüler 9",
                },
                classes: [],
                assignmentGroups: [],
                imageUrl: null,
              },
            ];
          }),
          entriesOf(111),
          (body) => {
            const entry = firstEntryOn(body, "2026-11-11");

            entry.position4 = [...list(entry.position4), { current: student, removed: null }];
            entry.secretNote = "Schüler 2";
            entry.status = "CHANGED";
            entry.substitutionText = "Herr Beispiel fehlt";
          },
        );

        // The same lesson in a student's own view, whose text names the student.
        const namedInOwnView = planted(
          named,
          RecordedWebUntis.paths.entries(10, "STUDENT", 501),
          (body) => {
            firstEntryOn(body, "2026-11-11").lessonText = "Nachschreiben Lena Muster";
          },
        );

        const ran = yield* runAt(morning, options(school, { source: recorded(namedInOwnView) }));

        const bodies = yield* sql<{ readonly body: string }>`
          select body::text as body from source_version where school_id = ${school}
        `;

        const text = bodies.map(({ body }) => body).join("\n");

        const [directory] = yield* sql<{ readonly students: number }>`
          select jsonb_array_length(body->'students') as students from source_version
          where school_id = ${school} and path = ${RecordedWebUntis.paths.filter(10, "CLASS")}
        `;

        const kept = (yield* checkpoint(school))?.previous ?? "";
        const stored = yield* SourceStore.recording(school);
        const fromStore = yield* ImportTesting.naive({ ...named, reads: stored });
        const fromRaw = yield* ImportTesting.naive(named);

        expect({
          outcome: ran.outcome,
          drift: ran.report.drift,
          // Students stay in the students' own directory, which this plan doesn't read.
          directoryStudents: directory?.students,
          // The store keeps WebUntis's free text; the checkpoint only stock phrases, as rows do.
          freeText: [text.includes("Herr Beispiel"), kept.includes("Herr Beispiel")],
          // The exam's students, the account's own name, and the planted ones.
          names: ["Schüler", '"S1"', '"S4"', '"S9"', "Konto A", "secretNote", "Lena"].filter(
            (name) => text.includes(name),
          ),
        }).toEqual({
          outcome: "Published",
          drift: ["<year>/entries/CLASS/<id> days[].gridEntries[].secretNote"],
          directoryStudents: 0,
          freeText: [true, false],
          names: [],
        });

        assert.deepStrictEqual(fromStore.result, fromRaw.result);
      }),
    );

    it.effect("a live run after a dark one publishes no lesson before its own day", () =>
      Effect.gen(function* () {
        const school = "tiny-dark-monday";
        const sql = yield* SqlClient.SqlClient;
        const dark = { ...options(school).profile, publish: false };
        const source = recorded(throughJanuary(TinySchool.corpus));
        yield* runAt(morning, options(school, { profile: dark, source }));

        const tuesday = yield* runAt(
          DateTime.add(morning, { days: 1 }),
          options(school, { source }),
        );

        const [monday] = yield* sql<{ readonly lessons: number }>`
          select count(*)::int as lessons from sync_row r join space s on s.id = r.space_id
          where s.parent_id = ${school} and r.tbl = 'Lesson' and r.data->>'date' = '2026-11-02'
        `;

        expect([tuesday.outcome, monday?.lessons]).toEqual(["Published", 0]);
      }),
    );

    // 3 December is day 29 after 4 November, whose lessons hold an Entfall. Each row runs where the
    // school's date is a day ahead of UTC's, and Auckland's also of Berlin's.
    it.effect.each([
      { school: "tiny-kept-berlin", zone: "Europe/Berlin", at: "2026-12-02T23:30:00Z" },
      { school: "tiny-kept-auckland", zone: "Pacific/Auckland", at: "2026-12-02T12:00:00Z" },
    ])(
      "on 3 December in $zone, removes 4 November's lessons and keeps 5 November's",
      ({ school, zone, at }) =>
        Effect.gen(function* () {
          const tiny = options(school).profile;
          const timeZone = CivilTime.TimeZone.make(zone);
          const profile = { ...tiny, school: { ...tiny.school, timeZone } };
          const source = recorded(throughJanuary(TinySchool.corpus));
          yield* runAt(morning, options(school, { profile, source }));
          const before = yield* lessonDays(school);
          const later = yield* runAt(DateTime.makeUnsafe(at), options(school, { profile, source }));
          const after = yield* lessonDays(school);

          expect({
            outcome: later.outcome,
            removed: before.filter((day) => !after.includes(day)),
            first: after[0],
          }).toEqual({
            outcome: "Published",
            removed: ["2026-11-02", "2026-11-03", "2026-11-04"],
            first: "2026-11-05",
          });
        }),
    );

    it.effect("a device offline for six weeks loses the lessons more than 28 days past", () =>
      Effect.gen(function* () {
        const school = School.Id.make("tiny-offline");
        const source = recorded(throughJanuary(TinySchool.corpus));
        yield* runAt(morning, options(school, { source }));
        yield* SchoolTesting.account("lena-offline");
        const { notebook } = yield* Access.admit("lena-offline", school, Option.none());
        const offered = yield* ImportTesting.at(morning)(Schools.offered(school, 11));
        yield* Access.enroll(notebook, Option.getOrThrow(offered));

        // A pull's lesson ops, by `<space> <id>`, with the day of each live one.
        const lessons = (response: Effect.Success<ReturnType<typeof pullOnce>>) =>
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

        const first = yield* pullOnce("lena-offline", []);
        const held = lessons(first);
        const cursors = first.patches.map(({ space, to }) => ({ space, version: to }));

        // 14 December less 28 days.
        const expired = held.flatMap(({ key, date }) =>
          Option.exists(date, (row) => row.date < "2026-11-16") ? [key] : [],
        );

        const later = yield* runAt(
          DateTime.add(morning, { days: 42 }),
          options(school, { source }),
        );

        const second = lessons(yield* pullOnce("lena-offline", cursors));

        expect({
          outcome: later.outcome,
          // Her phone held lessons on both sides of the cutoff.
          held: [expired.length > 0, expired.length < held.length],
          second: second.map(({ key, tag }) => `${key} ${tag}`).sort(),
        }).toEqual({
          outcome: "Published",
          held: [true, true],
          second: expired.map((key) => `${key} Deleted`).sort(),
        });
      }),
    );

    it.effect("a night whose students' directory changed keeps none older than 35 days", () =>
      Effect.gen(function* () {
        const school = School.Id.make("tiny-directory");
        const sql = yield* SqlClient.SqlClient;
        const corpus = throughJanuary(TinySchool.corpus);
        yield* runAt(morning, options(school, { source: recorded(corpus) }));
        const changed = options(school, { source: recorded(corpus, shorterDirectory) });
        const ran = yield* runAt(DateTime.add(morning, { days: 36 }), changed);

        const kept = yield* sql<{ readonly observed: string }>`
          select to_char(observed_at at time zone 'UTC', 'YYYY-MM-DD') as observed
          from source_version
          where school_id = ${school} and path = ${RecordedWebUntis.paths.filter(10, "STUDENT")}
        `;

        expect([ran.outcome, kept.map(({ observed }) => observed)]).toEqual([
          "Published",
          ["2026-12-08"],
        ]);
      }),
    );

    it.effect(
      "a dark run keeps its checkpoint and writes no row, and a live run builds on it",
      () =>
        Effect.gen(function* () {
          const school = "tiny-dark";
          const dark = { ...options(school).profile, publish: false };
          const first = yield* runAt(morning, options(school, { profile: dark }));

          const afterDark = {
            rows: yield* published(school),
            checkpoint: yield* checkpoint(school),
          };

          // WebUntis leaves out 9 November for `11.1`, so the live run doesn't cover that week.
          const withoutMonday = planted(TinySchool.corpus, entriesOf(111), (body) => {
            body.days = list(body.days).filter((day) => object(day).date !== "2026-11-09");
          });

          const live = yield* runAt(
            minutesAfter(10),
            options(school, { source: recorded(withoutMonday) }),
          );

          expect({
            first: first.outcome,
            rows: afterDark.rows,
            revision: afterDark.checkpoint?.revision,
            live: [live.outcome, (yield* checkpoint(school))?.revision],
            // Only the dark run saw the lesson, and nothing published says it is there.
            monday: (yield* idsOf(school, "Lesson")).has(mondayDe(school)),
          }).toEqual({
            first: "Dark",
            rows: [],
            revision: 1,
            live: ["Published", 2],
            monday: false,
          });
        }),
    );
  });
});

describe("ImportRun", () => {
  it.effect("admits no request past the reservation, the deadline or a lost session", () =>
    Effect.gen(function* () {
      const until = DateTime.makeUnsafe(60_000);
      const { gate, sent } = yield* ImportRun.dispatch(2, until);
      yield* gate.admit;
      yield* gate.admit;
      const over = yield* Effect.flip(gate.admit);
      const late = yield* ImportRun.dispatch(5, until);
      yield* TestClock.adjust("1 minute");
      const past = yield* Effect.flip(late.gate.admit);
      const lost = yield* ImportRun.dispatch(5, DateTime.makeUnsafe(120_000));
      yield* lost.gate.admit;
      yield* lost.gate.lose;
      const after = yield* Effect.flip(lost.gate.admit);

      expect([yield* sent, over._tag, past._tag, after._tag, yield* lost.sent]).toEqual([
        2,
        "ImportRun.OverReservation",
        "ImportRun.PastDeadline",
        "ImportRun.SessionLost",
        1,
      ]);
    }),
  );

  it("sends until the lease ends or the school's day does, also on the days the clocks change", () => {
    const school = TinySchool.profile.school;

    const until = (startedAt: string, leaseUntil: string) =>
      DateTime.formatIso(
        ImportRun.sendsUntil(
          school,
          DateTime.makeUnsafe(startedAt),
          DateTime.makeUnsafe(leaseUntil),
        ),
      );

    expect([
      until("2026-11-02T12:00:00Z", "2026-11-02T12:05:00Z"),
      until("2026-11-02T22:58:00Z", "2026-11-02T23:03:00Z"),
      until("2026-11-02T23:00:00Z", "2026-11-02T23:05:00Z"),
      until("2026-03-29T21:58:00Z", "2026-03-29T22:03:00Z"),
      until("2026-10-25T22:58:00Z", "2026-10-25T23:03:00Z"),
    ]).toEqual([
      "2026-11-02T12:05:00.000Z",
      "2026-11-02T23:00:00.000Z",
      "2026-11-02T23:05:00.000Z",
      "2026-03-29T22:00:00.000Z",
      "2026-10-25T23:00:00.000Z",
    ]);
  });

  it("covers from today to the last day read, stepping over weekends", () => {
    const window = {
      start: ImportTesting.today,
      end: CivilTime.addDays(ImportTesting.today, 27),
    };

    const covered = (...weeks: ReadonlyArray<readonly [string, string]>) =>
      CivilTime.format(
        ImportRun.coveredFrom(
          {
            covers: weeks.map(([start, end]) => ({ rows: "lessons" as const, start, end })),
            unattributed: [],
          },
          window,
        ),
      );

    expect([
      covered(["2026-11-02", "2026-11-06"], ["2026-11-09", "2026-11-13"]),
      covered(["2026-11-03", "2026-11-06"]),
      covered(["2026-11-02", "2026-11-05"]),
    ]).toEqual(["2026-11-15", "2026-11-01", "2026-11-05"]);
  });
});

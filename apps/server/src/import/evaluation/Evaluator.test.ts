import type { WebUntisClient } from "@schnau/webuntis-api";
import {
  ExamsSchema,
  TimetableEntriesSchema,
  TimetableFilterSchema,
} from "@schnau/webuntis-api/schemas";
import { assert, describe, it } from "@effect/vitest";
import { Course, School } from "@stu/core";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";
import { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import type { Corpus } from "../corpus/Corpus.ts";
import { ImportIds } from "../ImportIds.ts";
import { NaiveImport } from "../NaiveImport.ts";
import { SchoolImport } from "../SchoolImport.ts";
import { Evaluator } from "./Evaluator.ts";
import { Report } from "./Report.ts";
import { TinySchool } from "./TinySchool.ts";

const of = (right: number, total: number) => ({ right, of: total });

const identity = (realCourses: number, split: number, ourCourses: number, merged: number) => ({
  realCourses,
  split,
  ourCourses,
  merged,
});

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Json));
const decodeJson = Schema.decodeEffect(Schema.fromJsonString(Schema.Json));
const decodeFilter = Schema.decodeUnknownEffect(TimetableFilterSchema);
const encodeFilter = Schema.encodeEffect(Schema.toCodecJson(TimetableFilterSchema));
const decodeEntries = Schema.decodeUnknownEffect(Schema.toCodecJson(TimetableEntriesSchema));
const decodeExams = Schema.decodeUnknownEffect(Schema.toCodecJson(ExamsSchema));
const encodeExams = Schema.encodeEffect(Schema.toCodecJson(ExamsSchema));

/** TinySchool with `days` of one student's timetable hidden from the capture's account. */
const hiding = (student: number, days: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const path = RecordedWebUntis.paths.entries(10, "STUDENT", student);
    const hidden = new Set(days);

    const versions = yield* Effect.forEach(
      TinySchool.corpus.reads.get(path)?.versions ?? [],
      (version) =>
        Effect.map(decodeEntries(version.body), (body) => ({
          ...version,
          body: {
            ...body,
            days: body.days.map((day) =>
              hidden.has(day.date.slice(0, 10))
                ? { ...day, status: "NOT_ALLOWED_FOR_RESOURCE", gridEntries: [] }
                : day,
            ),
          },
        })),
    );

    return {
      ...TinySchool.corpus,
      reads: new Map([...TinySchool.corpus.reads, [path, { versions }]]),
    };
  });

const evaluate = (
  importLayer: Layer.Layer<SchoolImport.Service, never, WebUntisClient>,
  timeline = false,
  corpus: Corpus.Corpus = TinySchool.corpus,
) =>
  Evaluator.evaluate({
    corpus,
    corpusName: corpus.manifest.id,
    profile: TinySchool.profile,
    importName: "naive",
    importLayer,
    // The weeks the invented school's truth was written for. Its last two weeks fill a run's window.
    weeks: Option.some({ from: "2026-W44", to: "2026-W46" }),
    timeline,
  });

/** The naive import, with each run's result changed or refused. */
const variant = (
  change: (
    result: SchoolImport.ImportResult,
    input: SchoolImport.ImportInput,
  ) => Effect.Effect<SchoolImport.ImportResult, SchoolImport.ImportFailed>,
) =>
  Layer.effect(SchoolImport.Service)(
    Effect.gen(function* () {
      const naive = yield* SchoolImport.Service;

      return SchoolImport.Service.of({
        run: (input) => naive.run(input).pipe(Effect.flatMap((result) => change(result, input))),
      });
    }),
  ).pipe(Layer.provide(NaiveImport.layer));

const renameCourses = (
  rename: (lesson: SchoolImport.ImportedLesson, input: SchoolImport.ImportInput) => string,
) =>
  variant((result, input) => {
    const lessons = result.lessons.map((lesson) => ({
      ...lesson,
      courseId: Course.Id.make(rename(lesson, input)),
    }));

    return Effect.succeed({
      ...result,
      lessons,
      courses: lessons.map(({ courseId }) => ({ id: courseId, name: courseId })),
    });
  });

const dayOf = (now: DateTime.Utc) =>
  DateTime.formatIsoDate(DateTime.setZoneNamedUnsafe(now, School.defaultTimeZone));

// What the naive import gets right in both modes. The daily runs also catch what WebUntis showed
// on Wednesday of W45 at 10:00: a substitution and a withdrawn cancellation.
const both = {
  corpus: "tiny-school",
  import: "naive",
  weeks: ["2026-W44", "2026-W45", "2026-W46"],
  // MA23's two rows become two courses, the two MA-E groups one, and S8's two DE courses one.
  courses: of(1, 4),
  closures: { recall: of(1, 1), precision: of(1, 1) },
  links: of(43, 43),
  // The exam's course is both MA-E groups, so the other group's two students see it too.
  exams: of(0, 1),
  examStudents: { recall: of(2, 2), precision: of(2, 4) },
  // ISO parity makes W44 a B-week; the school restarted the count after the autumn break.
  weekLabels: of(0, 2),
  hiddenDays: 0,
  invariants: {
    failedRuns: 0,
    danglingCourses: 0,
    unpublishedLessons: 0,
    secondRunChanges: 0,
    reversedReadChanges: 0,
    failedReadChanges: 0,
    injectedFailures: 7,
  },
  // Students of `11.1` and `13`. `MA-E` shows each group the other's lessons.
  kurswahl: of(4, 8),
  ghostCourses: 0,
  // Split: MA23's two rows, and BI, booked under two classes, which nothing else measures. Merged:
  // the two MA-E groups, and S8's two DE courses, which a label tells apart. The joint INF lesson
  // is one course of both its classes.
  courseIdentity: {
    ...identity(13, 2, 13, 2),
    subjects: {
      BI: identity(1, 1, 2, 0),
      CH: identity(1, 0, 1, 0),
      DE: identity(3, 0, 2, 1),
      EN: identity(2, 0, 2, 0),
      INF: identity(1, 0, 1, 0),
      "MA-E": identity(2, 0, 1, 1),
      MA23: identity(1, 1, 2, 0),
      PH: identity(2, 0, 2, 0),
    },
  },
};

describe("Evaluator", () => {
  it.effect.each([
    {
      timeline: false,
      expected: {
        ...both,
        mode: "weekly" as const,
        // Students count in W46 only. Precision misses the other MA-E group.
        views: {
          student: {
            weeks: of(4, 8),
            recall: of(33, 33),
            precision: of(33, 37),
            attributes: of(33, 33),
          },
          teacher: {
            weeks: of(15, 18),
            recall: of(39, 40),
            precision: of(39, 40),
            attributes: of(38, 39),
          },
          room: {
            weeks: of(13, 15),
            recall: of(43, 43),
            precision: of(43, 43),
            attributes: of(41, 43),
          },
        },
        // "Betreuung" reads as a substitution, and Monday's run never sees Wednesday's version.
        changes: of(3, 5),
        courseIdsKept: of(172, 172),
        lookahead: of(43, 43),
        runs: { total: 5, failed: 0 },
        reads: { requests: 95, outOfRange: 18, decodeFailures: 0 },
        passingCases: [
          "cancellation",
          "free-day",
          "ma-e-group-kept",
          "room-change",
          "substitution",
        ],
      },
    },
    {
      timeline: true,
      expected: {
        ...both,
        mode: "timeline" as const,
        views: {
          student: {
            weeks: of(4, 8),
            recall: of(33, 33),
            precision: of(33, 37),
            attributes: of(33, 33),
          },
          teacher: {
            weeks: of(18, 18),
            recall: of(40, 40),
            precision: of(40, 40),
            attributes: of(40, 40),
          },
          room: {
            weeks: of(15, 15),
            recall: of(43, 43),
            precision: of(43, 43),
            attributes: of(43, 43),
          },
        },
        changes: of(4, 5),
        courseIdsKept: of(2107, 2107),
        lookahead: of(434, 434),
        runs: { total: 50, failed: 0 },
        reads: { requests: 1070, outOfRange: 276, decodeFailures: 0 },
        passingCases: [
          "cancellation",
          "free-day",
          "ma-e-group-kept",
          "room-change",
          "same-day-substitution",
          "substitution",
        ],
      },
    },
  ])("measures the naive import on TinySchool, timeline $timeline", ({ timeline, expected }) =>
    Effect.gen(function* () {
      const { worst: _, courseCases: __, ...report } = yield* evaluate(NaiveImport.layer, timeline);

      assert.deepStrictEqual(report, expected);
    }),
  );

  it.effect("says what each of the naive import's splits and merges looks like", () =>
    Effect.gen(function* () {
      const { courseCases } = yield* evaluate(NaiveImport.layer);

      assert.deepStrictEqual(
        courseCases.map(({ kind, subject, looksLike, ourCourses, realCourses }) => ({
          kind,
          subject,
          looksLike,
          ours: ourCourses.length,
          students: realCourses.map((real) => real.students),
        })),
        [
          { kind: "split", subject: "BI", looksLike: "spread", ours: 2, students: [["S2", "S3"]] },
          {
            kind: "merged",
            subject: "DE",
            looksLike: "overlapping",
            ours: 1,
            students: [["S8"], ["S8"]],
          },
          {
            kind: "merged",
            subject: "MA-E",
            looksLike: "disjoint",
            ours: 1,
            students: [
              ["S4", "S5"],
              ["S6", "S7"],
            ],
          },
          {
            kind: "split",
            subject: "MA23",
            looksLike: "spread",
            ours: 2,
            students: [["S5", "S6", "S8"]],
          },
        ],
      );
    }),
  );

  // Imports that are worse than naive in one way each. If one scores as well, the harness has
  // gone blind to that way.
  it.effect.each([
    {
      name: "fails whenever the store holds something",
      importLayer: variant((result, input) =>
        Option.isSome(input.previous)
          ? Effect.fail(new SchoolImport.ImportFailed({ reason: "variant" }))
          : Effect.succeed(result),
      ),
      measure: (report: Effect.Success<ReturnType<typeof evaluate>>) => ({
        runs: report.runs,
        failedReruns: report.invariants.failedRuns,
      }),
      expected: { runs: { total: 5, failed: 4 }, failedReruns: 2 },
    },
    {
      name: "makes one course per lesson",
      importLayer: renameCourses((lesson) => lesson.id),
      measure: (report: Effect.Success<ReturnType<typeof evaluate>>) => ({
        studentWeeks: report.views.student.weeks,
        recall: report.views.student.recall,
        courses: report.courses,
        split: report.courseIdentity.split,
      }),
      // Every real course with more than one entry is split.
      expected: { studentWeeks: of(0, 8), recall: of(0, 33), courses: of(2, 4), split: 8 },
    },
    {
      name: "makes new courses every run",
      importLayer: renameCourses((lesson, input) => `${lesson.courseId}@${dayOf(input.now)}`),
      measure: (report: Effect.Success<ReturnType<typeof evaluate>>) => ({
        studentWeeks: report.views.student.weeks,
        kept: report.courseIdsKept,
        ghosts: report.ghostCourses,
      }),
      // Lessons the later runs didn't touch keep their ids; the rest change. Nobody chose the
      // last run's courses.
      expected: { studentWeeks: of(0, 8), kept: of(127, 172), ghosts: 12 },
    },
    {
      name: "makes one course of each subject",
      importLayer: variant((result, input) => {
        const codes = new Map(result.subjects.map(({ id, shortName }) => [id, shortName]));

        const merged = new Map(
          result.courses.map(({ id, subjectId }) => [
            id,
            ImportIds.course(
              input.profile.id,
              (subjectId === undefined ? undefined : codes.get(subjectId)) ?? id,
            ),
          ]),
        );

        const lessons = result.lessons.map((lesson) => ({
          ...lesson,
          courseId: merged.get(lesson.courseId) ?? lesson.courseId,
        }));

        return Effect.succeed({
          ...result,
          lessons,
          courses: lessons.map(({ courseId }) => ({ id: courseId, name: courseId })),
        });
      }),
      measure: (report: Effect.Success<ReturnType<typeof evaluate>>) => ({
        kurswahl: report.kurswahl,
        identity: Struct.omit(report.courseIdentity, ["subjects"]),
      }),
      // `11.1` sees grade 12's `EN` and grade 13's `DE`, and `13` sees `11.1`'s `DE`. No real
      // course is split now, and each subject's courses merge.
      expected: { kurswahl: of(0, 8), identity: identity(13, 0, 8, 4) },
    },
    {
      name: "links lessons to entries WebUntis doesn't have",
      importLayer: variant((result) =>
        Effect.succeed({
          ...result,
          links: result.links.map((link) => ({
            ...link,
            refs: link.refs.map((ref) =>
              ref._tag === "Entry" ? { ...ref, ids: [...ref.ids, 999_999] } : ref,
            ),
          })),
        }),
      ),
      measure: (report: Effect.Success<ReturnType<typeof evaluate>>) => report.links,
      expected: of(0, 43),
    },
    {
      name: "reads only the current week",
      importLayer: variant((result, input) => {
        const today = dayOf(input.now);

        const thisWeek = result.covers.find(
          (cover) => cover.rows === "lessons" && cover.start <= today && today <= cover.end,
        );

        const end = thisWeek?.end ?? today;

        return Effect.succeed({
          ...result,
          lessons: result.lessons.filter((lesson) => lesson.date <= end),
          covers: result.covers.filter((cover) => cover.rows !== "lessons" || cover === thisWeek),
        });
      }),
      measure: (report: Effect.Success<ReturnType<typeof evaluate>>) => report.lookahead,
      expected: of(34, 43),
    },
    {
      name: "claims every week read without importing a lesson",
      importLayer: variant((result) => Effect.succeed({ ...result, lessons: [], links: [] })),
      measure: (report: Effect.Success<ReturnType<typeof evaluate>>) => ({
        lookahead: report.lookahead,
        recall: report.views.student.recall,
      }),
      expected: { lookahead: of(0, 43), recall: of(0, 33) },
    },
    {
      name: "keeps one lesson a day that claims all of the day's entries",
      importLayer: variant((result) => {
        const firsts = new Map(result.lessons.map((lesson) => [lesson.date, lesson.id]));
        const dayOf = new Map(result.lessons.map((lesson) => [lesson.id, lesson.date]));
        const lessonLinks = result.links.filter((link) => dayOf.has(link.id));

        return Effect.succeed({
          ...result,
          lessons: result.lessons.filter(({ id }) => firsts.get(dayOf.get(id) ?? "") === id),
          links: [
            ...result.links.filter((link) => !dayOf.has(link.id)),
            ...[...firsts.entries()].map(([date, id]) => ({
              id,
              refs: lessonLinks
                .filter((link) => dayOf.get(link.id) === date)
                .flatMap((link) => link.refs),
            })),
          ],
        });
      }),
      measure: (report: Effect.Success<ReturnType<typeof evaluate>>) => ({
        lookahead: report.lookahead,
        kurswahl: report.kurswahl,
      }),
      // Only the entries at the time of the one lesson kept count, and a lesson that claims
      // entries at other times gives no student their week.
      expected: { lookahead: of(17, 43), kurswahl: of(1, 8) },
    },
    {
      name: "puts the exam in a course of another subject with its teacher and students",
      importLayer: variant((result) =>
        Effect.succeed({
          ...result,
          exams: result.exams.map((exam) => ({
            ...exam,
            courseId: ImportIds.course(TinySchool.profile.id, "PH/12"),
          })),
        }),
      ),
      measure: (report: Effect.Success<ReturnType<typeof evaluate>>) => ({
        exams: report.exams,
        examStudents: report.examStudents,
      }),
      // Shown to exactly its students, unlike naive's exam, and still in the wrong course.
      expected: { exams: of(0, 1), examStudents: { recall: of(2, 2), precision: of(2, 2) } },
    },
    {
      name: "offers its courses to nobody",
      importLayer: variant((result) => Effect.succeed({ ...result, offerings: [] })),
      measure: (report: Effect.Success<ReturnType<typeof evaluate>>) =>
        report.invariants.unpublishedLessons,
      expected: 43,
    },
    {
      name: "drops its course rows",
      importLayer: variant((result) => Effect.succeed({ ...result, courses: [] })),
      measure: (report: Effect.Success<ReturnType<typeof evaluate>>) =>
        report.invariants.danglingCourses,
      expected: 74,
    },
  ])("scores an import that $name worse", ({ importLayer, measure, expected }) =>
    Effect.gen(function* () {
      assert.deepStrictEqual(measure(yield* evaluate(importLayer)), expected);
    }),
  );

  it.effect("measures the same when the capture's ranges overlap", () =>
    Effect.gen(function* () {
      const split = {
        ...TinySchool.corpus,
        manifest: {
          ...TinySchool.corpus.manifest,
          ranges: [
            { start: "2026-10-26", end: "2026-11-04" },
            { start: "2026-11-02", end: "2026-11-29" },
          ],
        },
      };

      const { worst: _, ...whole } = yield* evaluate(NaiveImport.layer);
      const { worst: __, ...overlapping } = yield* evaluate(NaiveImport.layer, false, split);

      assert.deepStrictEqual(overlapping, whole);
    }),
  );

  // Each row adds versions of one day to every timetable, as JSON edits of the latest version that
  // covers the day.
  it.effect.each([
    {
      // At noon on 4 November, after Monday's run read the week, WebUntis moves that day's third
      // block to the fifth.
      name: "a later version moves a lesson in its window",
      day: "2026-11-04",
      versions: [
        {
          observedAt: "2026-11-04T11:00:00Z",
          edit: (text: string) =>
            text
              .replaceAll('"2026-11-04T11:30"', '"2026-11-04T15:15"')
              .replaceAll('"2026-11-04T12:50"', '"2026-11-04T16:35"'),
        },
      ],
    },
    {
      // WebUntis answers 2 November with an error until noon that day, after Monday's run. The
      // run never scores its own day, so it mustn't need it.
      name: "its own day was incomplete when it ran",
      day: "2026-11-02",
      versions: [
        {
          observedAt: "2026-11-01T12:00:00Z",
          edit: (text: string) => text.replace('"errors":[]', '"errors":[{"code":"PARTIAL"}]'),
        },
        { observedAt: "2026-11-02T12:00:00Z", edit: (text: string) => text },
      ],
    },
  ])("keeps a correct import's full lookahead when $name", ({ day, versions }) =>
    Effect.gen(function* () {
      const reads = yield* Effect.forEach(TinySchool.corpus.reads, ([path, read]) =>
        path.includes("/entries/")
          ? Effect.forEach(versions, ({ observedAt, edit }) =>
              encodeJson(
                read.versions.findLast(
                  (version) => (version.start ?? day) <= day && day <= (version.end ?? day),
                )?.body ?? null,
              ).pipe(
                Effect.flatMap((text) => decodeJson(edit(text))),
                Effect.map((body) => ({
                  observedAt: DateTime.makeUnsafe(observedAt),
                  start: day,
                  end: day,
                  body,
                })),
              ),
            ).pipe(
              Effect.map((added) => Tuple.make(path, { versions: [...read.versions, ...added] })),
            )
          : Effect.succeed(Tuple.make(path, read)),
      );

      const { lookahead } = yield* evaluate(NaiveImport.layer, false, {
        ...TinySchool.corpus,
        reads: new Map(reads),
      });

      assert.deepStrictEqual(lookahead, of(43, 43));
    }),
  );

  it.effect("scores only the students whose timetables a capture reads", () =>
    Effect.gen(function* () {
      const path = RecordedWebUntis.paths.filter(10, "STUDENT");
      const [version] = TinySchool.corpus.reads.get(path)?.versions ?? [];
      const body = yield* decodeFilter(version?.body);

      // A grade 10 student, whose timetable the capture never reads, who also sits the exam.
      const lowerSchool = {
        ...TinySchool.corpus,
        reads: new Map([
          ...TinySchool.corpus.reads,
          [
            path,
            {
              versions: [
                {
                  observedAt: version?.observedAt ?? DateTime.makeUnsafe(0),
                  body: yield* encodeFilter({
                    ...body,
                    students: [
                      ...body.students,
                      {
                        student: { id: 599, shortName: "S99", longName: "S99", displayName: "S99" },
                        classes: [
                          {
                            class: {
                              id: 110,
                              shortName: "10.1",
                              longName: "10.1",
                              displayName: "10.1",
                            },
                            dateRange: { start: "2026-08-13", end: "2027-07-07" },
                            department: null,
                          },
                        ],
                        assignmentGroups: [],
                        imageUrl: null,
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        ]),
      };

      const examsPath = RecordedWebUntis.paths.exams(10);
      const [examsVersion] = TinySchool.corpus.reads.get(examsPath)?.versions ?? [];
      const exams = yield* decodeExams(examsVersion?.body);

      const sitting = exams.exams.map((exam) => ({
        ...exam,
        students: exam.students.flatMap((student) =>
          student.id === 504
            ? [
                student,
                { ...student, id: 599, shortName: "S99", longName: "S99", displayName: "S99" },
              ]
            : [student],
        ),
      }));

      lowerSchool.reads.set(examsPath, {
        versions: [
          {
            observedAt: examsVersion?.observedAt ?? DateTime.makeUnsafe(0),
            body: yield* encodeExams({ ...exams, exams: sitting }),
          },
        ],
      });

      const { worst: _, ...whole } = yield* evaluate(NaiveImport.layer);

      const { worst: __, ...withLowerSchool } = yield* evaluate(
        NaiveImport.layer,
        false,
        lowerSchool,
      );

      assert.deepStrictEqual(withLowerSchool, whole);
    }),
  );

  it.effect("says a corpus without students' views measures no Kurswahl, ghost or identity", () =>
    Effect.gen(function* () {
      const withoutStudents = {
        ...TinySchool.corpus,
        reads: new Map(
          [...TinySchool.corpus.reads].filter(([path]) => !path.includes("/entries/STUDENT/")),
        ),
      };

      const text = Report.format(yield* evaluate(NaiveImport.layer, false, withoutStudents));

      assert.deepStrictEqual(
        text
          .split("\n")
          .filter((line) => /Kurswahl|chose|identity/u.test(line))
          .map((line) => line.trim()),
        [
          "Kurswahl exactly right         not measured",
          "Courses no student chose: not measured.",
          "Course identity: not measured.",
        ],
      );
    }),
  );

  // An export of the source store holds no teacher or room views.
  it.effect("reports views the corpus lacks as not measured, and measures the rest alike", () =>
    Effect.gen(function* () {
      const withoutStaff = {
        ...TinySchool.corpus,
        reads: new Map(
          [...TinySchool.corpus.reads].filter(
            ([path]) => !/\/entries\/(?:TEACHER|ROOM)\//u.test(path),
          ),
        ),
      };

      const whole = yield* evaluate(NaiveImport.layer);
      const partial = yield* evaluate(NaiveImport.layer, false, withoutStaff);

      const nothing = {
        weeks: of(0, 0),
        recall: of(0, 0),
        precision: of(0, 0),
        attributes: of(0, 0),
      };

      assert.deepStrictEqual(
        {
          views: partial.views,
          kurswahl: partial.kurswahl,
          notMeasured: Report.format(partial)
            .split("\n")
            .filter((line) => line.endsWith("not measured"))
            .map((line) => line.replace("not measured", "").trim()),
        },
        {
          views: { ...whole.views, teacher: nothing, room: nothing },
          kurswahl: whole.kurswahl,
          notMeasured: [
            "Teacher lesson recall",
            "Teacher lesson precision",
            "Room lesson recall",
            "Room lesson precision",
            "Teacher-weeks exactly right",
            "Room-weeks exactly right",
          ],
        },
      );
    }),
  );

  // WebUntis hides a student's days from the capture's account from some date on. W46 is the one
  // week students are scored in, and S1's is exactly right. On its Wednesday S1 has two entries.
  it.effect.each([
    {
      name: "a day",
      days: ["2026-11-11"],
      // Neither the entries nor their lessons count, and S1's week stays exactly right.
      student: {
        weeks: of(4, 8),
        recall: of(31, 31),
        precision: of(31, 35),
        attributes: of(31, 31),
      },
    },
    {
      name: "the whole week",
      days: ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"],
      student: {
        weeks: of(3, 7),
        recall: of(28, 28),
        precision: of(28, 32),
        attributes: of(28, 28),
      },
    },
  ])(
    "measures nothing on $name a student's timetable hides, and doesn't fail",
    ({ days, student }) =>
      Effect.gen(function* () {
        const corpus = yield* hiding(501, days);

        const { worst: _, ...whole } = yield* evaluate(NaiveImport.layer);

        const { worst: __, ...report } = yield* evaluate(NaiveImport.layer, false, corpus);

        assert.deepStrictEqual(report, {
          ...whole,
          views: { ...whole.views, student },
          hiddenDays: days.length,
        });
      }),
  );

  // A Kurswahl or an exam WebUntis hid counts on neither side.
  it.effect.each([
    {
      name: "a student's opening weeks",
      student: 501,
      days: [
        "2026-10-26",
        "2026-10-27",
        "2026-10-28",
        "2026-10-29",
        "2026-10-30",
        "2026-11-02",
        "2026-11-03",
        "2026-11-04",
        "2026-11-05",
        "2026-11-06",
      ],
      // S1 is no longer counted, where an empty choice from nothing used to be exactly right.
      expected: {
        kurswahl: of(3, 7),
        exams: of(0, 1),
        examStudents: { recall: of(2, 2), precision: of(2, 4) },
        hiddenDays: 10,
        realCourses: 13,
      },
    },
    {
      name: "the day of a student's exam",
      student: 504,
      days: ["2026-11-05"],
      // S4 leaves the exam's roster and the students it is shown to.
      expected: {
        kurswahl: of(4, 8),
        exams: of(0, 1),
        examStudents: { recall: of(1, 1), precision: of(1, 3) },
        hiddenDays: 1,
        realCourses: 13,
      },
    },
    {
      // S5 leaves every roster of the term, so the first MA-E group's two Mondays stay one real
      // course rather than one of S4 and one of S4 and S5.
      name: "a day of a student's opening weeks",
      student: 505,
      days: ["2026-10-26"],
      expected: {
        kurswahl: of(4, 8),
        exams: of(0, 1),
        examStudents: { recall: of(2, 2), precision: of(2, 4) },
        hiddenDays: 1,
        realCourses: 13,
      },
    },
  ])("doesn't count what WebUntis hid on $name", ({ student, days, expected }) =>
    Effect.gen(function* () {
      const report = yield* evaluate(NaiveImport.layer, false, yield* hiding(student, days));

      assert.deepStrictEqual(
        {
          kurswahl: report.kurswahl,
          exams: report.exams,
          examStudents: report.examStudents,
          hiddenDays: report.hiddenDays,
          realCourses: report.courseIdentity.realCourses,
        },
        expected,
      );
    }),
  );

  it.effect("refuses weeks that hold none the corpus captured", () =>
    Effect.gen(function* () {
      const error = yield* Evaluator.evaluate({
        corpus: TinySchool.corpus,
        corpusName: TinySchool.corpus.manifest.id,
        profile: TinySchool.profile,
        importName: "naive",
        importLayer: NaiveImport.layer,
        weeks: Option.some({ from: "2026-W50", to: "2026-W51" }),
        timeline: false,
      }).pipe(Effect.flip);

      assert.deepStrictEqual(
        error,
        new Evaluator.NothingMeasured({ captured: ["2026-W44", "2026-W45", "2026-W46"] }),
      );
    }),
  );

  it.effect("refuses a corpus that lacks a read inside its captured days", () =>
    Effect.gen(function* () {
      const read = RecordedWebUntis.paths.entries(10, "CLASS", 111);

      const error = yield* evaluate(NaiveImport.layer, false, {
        ...TinySchool.corpus,
        reads: new Map([...TinySchool.corpus.reads].filter(([path]) => path !== read)),
      }).pipe(Effect.flip);

      assert.deepStrictEqual(
        error,
        new Evaluator.NotCaptured({
          reads: [`${read} 2026-10-26`, `${read} 2026-11-02`, `${read} 2026-11-09`],
        }),
      );
    }),
  );
});

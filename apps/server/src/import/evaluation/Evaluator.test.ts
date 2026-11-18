import type { WebUntisClient } from "@schnau/webuntis-api";
import { assert, describe, it } from "@effect/vitest";
import { Course, School } from "@stu/core";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import type { Corpus } from "../corpus/Corpus.ts";
import { NaiveImport } from "../NaiveImport.ts";
import { SchoolImport } from "../SchoolImport.ts";
import { Evaluator } from "./Evaluator.ts";
import { TinySchool } from "./TinySchool.ts";

const of = (right: number, total: number) => ({ right, of: total });

const evaluate = (
  importLayer: Layer.Layer<SchoolImport.Service, never, WebUntisClient>,
  timeline = false,
  corpus: Corpus.Corpus = TinySchool.corpus,
) =>
  Evaluator.evaluate({
    corpus,
    corpusName: corpus.manifest.id,
    importName: "naive",
    importLayer,
    weeks: Option.none(),
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
  // MA23's two rows become two courses, and the two MA-E groups one.
  courses: of(1, 3),
  closures: { recall: of(1, 1), precision: of(1, 1) },
  links: of(35, 35),
  // The exam's course is both MA-E groups, so the other group's two students see it too.
  exams: of(0, 1),
  examStudents: { recall: of(2, 2), precision: of(2, 4) },
  // ISO parity makes W44 a B-week; the school restarted the count after the autumn break.
  weekLabels: of(0, 2),
  invariants: {
    failedRuns: 0,
    danglingCourses: 0,
    secondRunChanges: 0,
    reversedReadChanges: 0,
    failedReadChanges: 0,
    injectedFailures: 4,
  },
};

describe("Evaluator", () => {
  it.effect.each([
    {
      timeline: false,
      expected: {
        ...both,
        mode: "weekly",
        // Students count in W46 only. Precision misses the other MA-E group and the joint INF
        // lesson, counted once per class.
        views: {
          student: {
            weeks: of(3, 8),
            recall: of(26, 26),
            precision: of(26, 32),
            attributes: of(26, 26),
          },
          teacher: {
            weeks: of(13, 18),
            recall: of(28, 29),
            precision: of(28, 32),
            attributes: of(27, 28),
          },
          room: {
            weeks: of(11, 15),
            recall: of(32, 32),
            precision: of(32, 35),
            attributes: of(30, 32),
          },
        },
        // "Betreuung" reads as a substitution, and Monday's run never sees Wednesday's version.
        changes: of(3, 5),
        courseIdsKept: of(53, 53),
        lookahead: of(29, 29),
        runs: { total: 3, failed: 0 },
        reads: { requests: 36, outOfRange: 3, decodeFailures: 0 },
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
        mode: "timeline",
        views: {
          student: {
            weeks: of(3, 8),
            recall: of(26, 26),
            precision: of(26, 32),
            attributes: of(26, 26),
          },
          teacher: {
            weeks: of(15, 18),
            recall: of(29, 29),
            precision: of(29, 32),
            attributes: of(29, 29),
          },
          room: {
            weeks: of(12, 15),
            recall: of(32, 32),
            precision: of(32, 35),
            attributes: of(32, 32),
          },
        },
        changes: of(4, 5),
        courseIdsKept: of(393, 393),
        lookahead: of(125, 125),
        runs: { total: 15, failed: 0 },
        reads: { requests: 180, outOfRange: 15, decodeFailures: 0 },
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
      const { worst: _, ...report } = yield* evaluate(NaiveImport.layer, timeline);

      assert.deepStrictEqual(report, expected);
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
      expected: { runs: { total: 3, failed: 2 }, failedReruns: 2 },
    },
    {
      name: "makes one course per lesson",
      importLayer: renameCourses((lesson) => lesson.id),
      measure: (report: Effect.Success<ReturnType<typeof evaluate>>) => ({
        studentWeeks: report.views.student.weeks,
        recall: report.views.student.recall,
        courses: report.courses,
      }),
      expected: { studentWeeks: of(0, 8), recall: of(0, 26), courses: of(1, 3) },
    },
    {
      name: "makes new courses every run",
      importLayer: renameCourses((lesson, input) => `${lesson.courseId}@${dayOf(input.now)}`),
      measure: (report: Effect.Success<ReturnType<typeof evaluate>>) => ({
        studentWeeks: report.views.student.weeks,
        kept: report.courseIdsKept,
      }),
      // Lessons the later runs didn't touch keep their ids; the rest change.
      expected: { studentWeeks: of(0, 8), kept: of(31, 53) },
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
      expected: of(0, 35),
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
      expected: of(23, 29),
    },
    {
      name: "claims every week read without importing a lesson",
      importLayer: variant((result) => Effect.succeed({ ...result, lessons: [], links: [] })),
      measure: (report: Effect.Success<ReturnType<typeof evaluate>>) => ({
        lookahead: report.lookahead,
        recall: report.views.student.recall,
      }),
      expected: { lookahead: of(0, 29), recall: of(0, 26) },
    },
    {
      name: "drops its course rows",
      importLayer: variant((result) => Effect.succeed({ ...result, courses: [] })),
      measure: (report: Effect.Success<ReturnType<typeof evaluate>>) =>
        report.invariants.danglingCourses,
      expected: 36,
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
            { start: "2026-11-02", end: "2026-11-15" },
          ],
        },
      };

      const { worst: _, ...whole } = yield* evaluate(NaiveImport.layer);
      const { worst: __, ...overlapping } = yield* evaluate(NaiveImport.layer, false, split);

      assert.deepStrictEqual(overlapping, whole);
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

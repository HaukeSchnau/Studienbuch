import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { NaiveImport } from "../NaiveImport.ts";
import { Evaluator } from "./Evaluator.ts";
import { TinySchool } from "./fixtures/TinySchool.ts";

const of = (right: number, total: number) => ({ right, of: total });

// What the naive import gets right in both modes, and what only the daily runs catch: the
// substitution and the withdrawn cancellation that WebUntis showed on Wednesday at 10:00.
const both = {
  corpus: "tiny-school",
  import: "naive",
  weeks: ["2026-W44", "2026-W45"],
  closures: of(10, 10),
  // The exam's course is both MA-E groups, so the other group's two students see it too.
  exams: of(0, 1),
  examStudents: { recall: of(2, 2), precision: of(2, 4) },
  // ISO parity makes W44 a B-week; the school restarted the count after the autumn break.
  weekLabels: of(0, 2),
  alternation: of(3, 3),
  invariants: {
    secondRunChanges: 0,
    reversedReadChanges: 0,
    deletedOnFailure: 0,
    injectedFailures: 3,
  },
};

describe("Evaluator", () => {
  it.effect.each([
    {
      timeline: false,
      expected: {
        ...both,
        mode: "weekly",
        // Precision misses the other MA-E group and the joint INF lesson, counted once per class.
        views: {
          student: {
            weeks: of(4, 16),
            recall: of(48, 48),
            precision: of(48, 60),
            attributes: of(43, 48),
          },
          teacher: {
            weeks: of(8, 12),
            recall: of(18, 19),
            precision: of(18, 21),
            attributes: of(17, 18),
          },
          room: {
            weeks: of(7, 10),
            recall: of(21, 21),
            precision: of(21, 23),
            attributes: of(19, 21),
          },
        },
        // "Betreuung" reads as a substitution, and Monday's run never sees Wednesday's version.
        changes: of(3, 5),
        courseIdsKept: of(21, 21),
        reads: { runs: 2, requests: 24, notCaptured: 3, decodeFailures: 0 },
        passingCases: ["cancellation", "free-day", "room-change", "substitution"],
      },
    },
    {
      timeline: true,
      expected: {
        ...both,
        mode: "timeline",
        views: {
          student: {
            weeks: of(6, 16),
            recall: of(48, 48),
            precision: of(48, 60),
            attributes: of(48, 48),
          },
          teacher: {
            weeks: of(10, 12),
            recall: of(19, 19),
            precision: of(19, 21),
            attributes: of(19, 19),
          },
          room: {
            weeks: of(8, 10),
            recall: of(21, 21),
            precision: of(21, 23),
            attributes: of(21, 21),
          },
        },
        changes: of(4, 5),
        courseIdsKept: of(189, 189),
        reads: { runs: 10, requests: 120, notCaptured: 15, decodeFailures: 0 },
        passingCases: [
          "cancellation",
          "free-day",
          "room-change",
          "same-day-substitution",
          "substitution",
        ],
      },
    },
  ])("measures the naive import on TinySchool, timeline $timeline", ({ timeline, expected }) =>
    Effect.gen(function* () {
      const { worst: _, ...report } = yield* Evaluator.evaluate({
        corpus: TinySchool.corpus,
        corpusName: TinySchool.corpus.manifest.id,
        importName: "naive",
        importLayer: NaiveImport.layer,
        weeks: Option.none(),
        timeline,
      });

      assert.deepStrictEqual(report, expected);
    }),
  );
});

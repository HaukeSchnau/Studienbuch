import { assert, describe, it } from "@effect/vitest";
import { CivilTime, Course } from "@stu/core";
import * as Effect from "effect/Effect";
import { RecordedWebUntis } from "../infra/webuntis/RecordedWebUntis.ts";
import { Metrics } from "./evaluation/Metrics.ts";
import { TinySchool } from "./evaluation/TinySchool.ts";
import { Truth } from "./evaluation/Truth.ts";
import { ImportIds } from "./ImportIds.ts";
import { ImportTesting } from "./ImportTesting.ts";
import { SchoolProfile } from "./profiles/SchoolProfile.ts";
import { SchoolImport } from "./SchoolImport.ts";
import { SelfCheck } from "./SelfCheck.ts";

const { morning, today } = ImportTesting;

/** The nightly run's input on Monday of 2026-W45: its lessons and the students' own views. */
const night = Effect.gen(function* () {
  const { result } = yield* ImportTesting.naive(TinySchool.corpus);
  const state = SchoolImport.apply(SchoolImport.empty, result);
  const days = { start: today, end: CivilTime.addDays(today, 27) };
  const { client } = yield* RecordedWebUntis.make(TinySchool.corpus.reads, { asOf: morning });

  const { views } = yield* Truth.readViews(
    client,
    [{ start: CivilTime.format(days.start), end: CivilTime.format(days.end) }],
    ["STUDENT"],
    (student) => SchoolProfile.readsStudent(TinySchool.profile, student),
  );

  return {
    students: [...views.values()],
    lessons: Metrics.lessonsOf(state),
    terms: state.terms,
    days,
    kept: [],
  } satisfies SelfCheck.Input;
});

describe("SelfCheck", () => {
  // The import splits `DE/11.1` from 2026-W47 on, after the night that kept its students' choice.
  it.effect("shows a course split after the Kurswahl was kept as missing lessons", () =>
    Effect.gen(function* () {
      const input = yield* night;
      const first = SelfCheck.score(input);
      const de = ImportIds.course(TinySchool.profile.id, "DE/11.1");
      const split = Course.Id.make("split-de");

      const moved = input.lessons.filter(
        ({ courseId, date }) => courseId === de && date >= "2026-11-16",
      );

      const later = SelfCheck.score({
        ...input,
        lessons: input.lessons.map((lesson) =>
          moved.includes(lesson) ? { ...lesson, courseId: split } : lesson,
        ),
        kept: first.kept,
      });

      const { studentWeeks } = first.measured;
      // Each lesson of `DE/11.1` is one of its three students' entries.
      const missing = 3 * moved.length;

      assert.isAbove(moved.length, 0);

      assert.deepStrictEqual(
        {
          chosen: later.measured.chosen,
          kept: later.kept,
          recall: later.measured.studentWeeks.recall,
          ghostCourses: later.measured.ghostCourses,
        },
        {
          chosen: 0,
          kept: first.kept,
          recall: Metrics.fraction(studentWeeks.recall.right - missing, studentWeeks.recall.of),
          ghostCourses: first.measured.ghostCourses + 1,
        },
      );
    }),
  );

  it.effect("takes no Kurswahl while WebUntis hides one of its opening days", () =>
    Effect.gen(function* () {
      const input = yield* night;

      const students = input.students.map((student) =>
        student.id === 501 ? { ...student, hidden: new Set(["2026-11-04"]) } : student,
      );

      const { kept } = SelfCheck.score({ ...input, students });

      assert.deepStrictEqual(kept.map(({ student }) => student).includes(501), false);
    }),
  );

  it.effect("drops the Kurswahlen of a term that ended", () =>
    Effect.gen(function* () {
      const input = yield* night;
      const { kept } = SelfCheck.score(input);
      const [one] = kept;

      const ended = {
        ...input,
        terms: input.terms.map((term) => ({ ...term, end: "2026-11-01" })),
      };

      assert.deepStrictEqual(
        {
          students: kept.length,
          opening: one?.opening,
          ended: SelfCheck.score({ ...ended, kept }).kept,
        },
        { students: 8, opening: ["2026-W45", "2026-W46"], ended: [] },
      );
    }),
  );
});

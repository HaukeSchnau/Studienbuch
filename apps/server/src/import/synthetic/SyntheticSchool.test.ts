import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CourseIdentity } from "../evaluation/CourseIdentity.ts";
import { Metrics } from "../evaluation/Metrics.ts";
import { Students } from "../evaluation/Students.ts";
import { Truth } from "../evaluation/Truth.ts";
import { IgsLilienthal } from "../profiles/IgsLilienthal.ts";
import { Calibrate } from "./Calibrate.ts";
import { Committed } from "./Committed.ts";
import { SyntheticSchool } from "./SyntheticSchool.ts";

const keyOf = (entry: { readonly date: string; readonly ids: ReadonlyArray<number> }) =>
  `${entry.date} ${entry.ids.join("+")}`;

/** The import that gets everything right: a lesson per entry, in the entry's true course. */
const perfect = (school: SyntheticSchool.School, entries: ReadonlyArray<Metrics.TruthEntry>) =>
  entries.map((entry): Metrics.Lesson => ({
    id: keyOf(entry),
    courseId: school.courseOf.get(keyOf(entry)) ?? "unknown",
    date: entry.date,
    start: entry.start,
    end: entry.end,
    status: entry.status,
    teachers: entry.teachers,
    rooms: entry.rooms,
    previousTeachers: entry.previousTeachers,
    previousRooms: entry.previousRooms,
    kind: undefined,
    entries: [{ date: entry.date, ids: entry.ids }],
  }));

describe("SyntheticSchool", () => {
  it.effect("builds the same school from the same seed, and another from another", () =>
    Effect.gen(function* () {
      const calibration = yield* Committed.calibration;
      const a = yield* SyntheticSchool.generate(calibration, 1);
      const b = yield* SyntheticSchool.generate(calibration, 1);
      const c = yield* SyntheticSchool.generate(calibration, 2);

      assert.deepStrictEqual(a.corpus, b.corpus);
      assert.notDeepEqual(a.corpus.reads, c.corpus.reads);
    }),
  );

  // The harness finds real courses from rosters and labels. If the generator's views or labels
  // disagreed with its own courses, an import holding exactly those courses would lose points.
  // Only the students who switch in the opening weeks lose them: their Kurswahl holds both courses,
  // as the harness takes it, and that is the pitfall.
  it.effect("scores an import of exactly its true courses as right, but for opening movers", () =>
    Effect.gen(function* () {
      const school = yield* Committed.school;
      const truth = yield* Truth.build(school.corpus);
      const weekOf = (date: string) => truth.weekOf.get(date) ?? "";
      const lessons = perfect(school, truth.entries);
      const weeks = [...new Set(truth.days.map(weekOf))].sort();

      const full = weeks.filter(
        (week) => truth.days.filter((day) => weekOf(day) === week).length === 5,
      );

      const opening = new Set(full.slice(0, 2));
      const inOpening = (date: string) => opening.has(weekOf(date));
      const openingLessons = lessons.filter((lesson) => inOpening(lesson.date));
      const store = { lessons: openingLessons, index: Metrics.byEntry(openingLessons) };
      const students = truth.views.filter((view) => view.type === "STUDENT");

      const attending = students.filter(
        (view) => !truth.days.some((day) => inOpening(day) && view.hidden.has(day)),
      );

      const identity = CourseIdentity.measure({
        term: "1",
        attendance: attending.map((view) => ({
          student: view.name,
          entries: view.entries.filter((entry) => inOpening(entry.date)),
        })),
        index: store.index,
        labels: school.corpus.cases.courses,
        weekOf,
      });

      assert.deepStrictEqual(
        { split: identity.total.split, merged: identity.total.merged },
        { split: 0, merged: 0 },
      );

      assert.strictEqual(identity.total.realCourses, identity.total.ourCourses);

      const joinedOn = new Map(
        school.moves.flatMap((move) =>
          move.from === undefined ? [[move.student, move.date]] : [],
        ),
      );

      const wrong = attending.flatMap((view) => {
        const { courses, exact } = Students.choose(view, inOpening, store);
        const joined = joinedOn.get(view.id);

        const weeksWrong = full
          .filter((week) => week > (full[1] ?? "") && view.weeks.has(week))
          .filter((week) => joined === undefined || week < weekOf(joined))
          .filter(
            (week) =>
              !truth.days.some((day) => weekOf(day) === week && view.hidden.has(day)) &&
              !Metrics.isExact(
                Students.week(view, (date) => weekOf(date) === week, lessons, courses),
              ),
          );

        return exact && weeksWrong.length === 0 ? [] : [{ student: view.name, exact, weeksWrong }];
      });

      const movers = new Set(
        school.moves.flatMap((move) => (move.from === undefined ? [] : [move.student])),
      );

      assert.deepStrictEqual(
        wrong.map((each) => each.student).sort(),
        attending.flatMap((view) => (movers.has(view.id) ? [view.name] : [])).sort(),
      );

      assert.isAbove(movers.size, 0);
      assert.isAbove(joinedOn.size, 0);
    }),
  );

  // The calibration's pitfalls are what the generator is for: each must come back, about as
  // often per term, when the synthetic school is measured the way corpus v1 was.
  it.effect("plants every pitfall the calibration names, about as often", () =>
    Effect.gen(function* () {
      const calibration = yield* Committed.calibration;
      const school = yield* Committed.school;
      const { pitfalls } = yield* Calibrate.observe(school.corpus, IgsLilienthal.profile);

      const ratios = Object.entries(calibration.pitfalls).map(([name, expected]) => {
        const perTerm = expected.count / calibration.terms;

        return [name, (pitfalls[name]?.count ?? 0) / perTerm] as const;
      });

      for (const [name, ratio] of ratios) {
        assert.isTrue(ratio >= 0.5 && ratio <= 2, `${name}: ${ratio} times the calibration's rate`);
      }
    }),
  );
});

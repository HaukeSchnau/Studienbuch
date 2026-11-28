/**
 * The nightly self-check (m2-import-path.md, section 7): the upper school's own timetables against
 * the lessons the night's projection publishes, by the harness's measures. A Kurswahl is kept per
 * student and term, so a course the import later splits shows as missing lessons. No names.
 */
import { CivilTime, Course, Term } from "@stu/core";
import * as Arr from "effect/Array";
import * as Schema from "effect/Schema";
import { CourseIdentity } from "./evaluation/CourseIdentity.ts";
import { Metrics } from "./evaluation/Metrics.ts";
import { Report } from "./evaluation/Report.ts";
import { Students } from "./evaluation/Students.ts";
import type { Truth } from "./evaluation/Truth.ts";
import type { SchoolProfile } from "./profiles/SchoolProfile.ts";
import type { SchoolImport } from "./SchoolImport.ts";

export * as SelfCheck from "./SelfCheck.ts";

/**
 * One student's Kurswahl in one term, taken from the first two full weeks of the window in the
 * term on the first night that shows the student, and kept until the term ends.
 */
export const Kept = Schema.Struct({
  /** The student's WebUntis id. */
  student: Schema.Int,
  term: Term.Id,
  /** The two ISO weeks it was taken from, such as `2026-W49`. Only later weeks score it. */
  opening: Schema.Array(Schema.String),
  courses: Schema.Array(Course.Id),
  /** Whether those courses' lessons were exactly the student's entries of the opening weeks. */
  exact: Schema.Boolean,
});

export type Kept = typeof Kept.Type;

export const Measured = Schema.Struct({
  /** Upper-school students whose views the night read. */
  students: Schema.Int,
  /** Kurswahlen taken this night. */
  chosen: Schema.Int,
  /** Each student's weeks after their opening weeks, as the harness scores student views. */
  studentWeeks: Report.View,
  /** Of the night's students' Kurswahlen. */
  kurswahl: Report.Fraction,
  ghostCourses: Schema.Int,
  /** Real courses against ours, from the rosters of the window's first two full weeks. */
  courseIdentity: Report.Identity,
  /** School days of the night's views that WebUntis hid from the account. */
  hiddenDays: Schema.Int,
});

export type Measured = typeof Measured.Type;

export const Result = Schema.TaggedUnion({
  Measured: Measured.fields,
  /** A student view or the directory didn't answer, or didn't fit the reservation: a tag. */
  NotMeasured: { reason: Schema.String },
});

export type Result = typeof Result.Type;

export interface Input {
  /** The upper school's views of the days the run read, as `Truth.readViews` reads them. */
  readonly students: ReadonlyArray<Truth.View>;
  /** The lessons the projection publishes, in the harness's terms. */
  readonly lessons: ReadonlyArray<Metrics.Lesson>;
  readonly terms: SchoolImport.ImportResult["terms"];
  /** What the projection offers, for the courses a student's class joins them to. */
  readonly offered: Students.Offered;
  readonly classify: SchoolProfile.SchoolProfile["classify"];
  /** Today to the last day the run read. */
  readonly days: CivilTime.DateRange;
  readonly kept: ReadonlyArray<Kept>;
}

interface Week {
  readonly week: string;
  readonly term: Term.Id;
  /** Monday to Friday. */
  readonly dates: ReadonlySet<string>;
}

/** The ISO weeks whose Monday to Friday lie in `days` and in one term, in order. */
const fullWeeks = (
  days: CivilTime.DateRange,
  terms: SchoolImport.ImportResult["terms"],
): ReadonlyArray<Week> => {
  const weeks: Array<Week> = [];

  for (
    let monday = days.start;
    CivilTime.order(CivilTime.addDays(monday, 4), days.end) <= 0;
    monday = CivilTime.addDays(monday, 1)
  ) {
    if (CivilTime.dayOfWeek(monday) !== 1) continue;

    const dates = Arr.makeBy(5, (offset) => CivilTime.format(CivilTime.addDays(monday, offset)));
    const first = dates[0] ?? "";
    const last = dates[4] ?? "";
    const term = terms.find(({ start, end }) => start <= first && last <= end);

    if (term !== undefined) {
      weeks.push({ week: CivilTime.isoWeek(monday), term: term.id, dates: new Set(dates) });
    }
  }

  return weeks;
};

const keyOf = (student: number, term: string) => `${student} ${term}`;

/**
 * The night's measures, and the Kurswahlen to keep: those of terms that haven't ended, with one
 * taken for every student the night shows on both of a term's opening weeks for the first time.
 */
export const score = (input: Input) => {
  const weeks = fullWeeks(input.days, input.terms);
  const today = CivilTime.format(input.days.start);

  const students = Students.attended(
    input.students,
    (date) => input.terms.find(({ start, end }) => start <= date && date <= end)?.id,
  );

  const weekOf = new Map(
    weeks.flatMap(({ week, dates }) => [...dates].map((date) => [date, week])),
  );

  const store = { lessons: input.lessons, index: Metrics.byEntry(input.lessons) };
  const terms = Arr.dedupe(weeks.map(({ term }) => term));
  const ending = new Map(input.terms.map(({ id, end }) => [id, end]));

  const opening = new Map(
    terms.map((term) => [term, weeks.filter((week) => week.term === term).slice(0, 2)]),
  );

  const kept = new Map(
    input.kept
      .filter(({ term }) => (ending.get(term) ?? "") >= today)
      .map((each) => [keyOf(each.student, each.term), each]),
  );

  const within = (some: ReadonlyArray<Week>) => (date: string) =>
    some.some(({ dates }) => dates.has(date));

  const ofJoined = new Map<string, ReadonlySet<string>>();

  // The courses a student's classes join them to come from each night's offerings, so an event
  // course created after the Kurswahl was kept still counts.
  const joinedOn = (student: Truth.View) => (date: string) => {
    const key = keyOf(student.id, date);

    const known =
      ofJoined.get(key) ?? Students.joined(input.offered, input.classify, student, date);

    ofJoined.set(key, known);

    return known;
  };

  let chosen = 0;

  for (const student of students) {
    for (const term of terms) {
      const openingWeeks = opening.get(term) ?? [];

      const shown = (week: Week) => student.entries.some(({ date }) => week.dates.has(date));

      // A day WebUntis hides could hold a course, which the choice would then miss all term.
      if (
        kept.has(keyOf(student.id, term)) ||
        openingWeeks.length < 2 ||
        !openingWeeks.every(shown) ||
        [...student.hidden].some(within(openingWeeks))
      ) {
        continue;
      }

      const { courses, exact } = Students.choose(student, within(openingWeeks), store, {
        required: Students.required(input.offered, [...(openingWeeks[0]?.dates ?? [])][0] ?? ""),
        joinedOn: joinedOn(student),
      });

      kept.set(keyOf(student.id, term), {
        student: student.id,
        term,
        opening: openingWeeks.map(({ week }) => week),
        courses: [...courses].sort().map((course) => Course.Id.make(course)),
        exact,
      });

      chosen += 1;
    }
  }

  const lessonsIn = Map.groupBy(input.lessons, ({ date }) => weekOf.get(date) ?? "");

  const scored = students.flatMap((student) =>
    weeks.flatMap((week) => {
      const choice = kept.get(keyOf(student.id, week.term));

      if (
        choice === undefined ||
        !choice.opening.every((each) => each < week.week) ||
        [...week.dates].every((date) => student.hidden.has(date))
      ) {
        return [];
      }

      return [
        {
          week,
          score: Students.week(
            student,
            (date) => week.dates.has(date),
            lessonsIn.get(week.week) ?? [],
            (date) => new Set([...choice.courses, ...joinedOn(student)(date)]),
          ),
        },
      ];
    }),
  );

  const tonight = new Set(students.map(({ id }) => id));

  const choices = [...kept.values()].filter(
    ({ student, term }) => tonight.has(student) && terms.includes(term),
  );

  const scoredWeeks = new Set(scored.map(({ week }) => week.week));

  const ghostCourses = Students.ghosts(
    terms.map((term) => ({
      lessons: weeks
        .filter((week) => week.term === term && scoredWeeks.has(week.week))
        .flatMap((week) => lessonsIn.get(week.week) ?? []),
      takenOn: (date: string) =>
        new Set([
          ...[...kept.values()].flatMap((each) => (each.term === term ? each.courses : [])),
          ...students.flatMap((student) => [...joinedOn(student)(date)]),
        ]),
    })),
  );

  // As the harness does, a student WebUntis hid an opening day from counts in no roster.
  const identity = CourseIdentity.combine(
    terms.flatMap((term) => {
      const openingWeeks = opening.get(term) ?? [];
      const inOpening = within(openingWeeks);

      return openingWeeks.length < 2
        ? []
        : [
            CourseIdentity.measure({
              term,
              attendance: students
                .filter((student) => ![...student.hidden].some(inOpening))
                .map((student) => ({
                  student: String(student.id),
                  entries: student.entries.filter((entry) => inOpening(entry.date)),
                })),
              index: store.index,
              labels: [],
              weekOf: (date) => weekOf.get(date) ?? "",
            }),
          ];
    }),
  ).counts;

  return {
    measured: {
      students: students.length,
      chosen,
      studentWeeks: Metrics.summarize(scored.map(({ score: each }) => each)),
      kurswahl: Metrics.fraction(choices.filter(({ exact }) => exact).length, choices.length),
      ghostCourses,
      courseIdentity: {
        realCourses: identity.realCourses,
        split: identity.split,
        ourCourses: identity.ourCourses,
        merged: identity.merged,
      },
      hiddenDays: students.reduce((count, { hidden }) => count + hidden.size, 0),
    },
    kept: [...kept.values()].toSorted(
      (a, b) => a.term.localeCompare(b.term) || a.student - b.student,
    ),
  };
};

/** One measure against its threshold, as `import status` shows it. */
export interface Measure {
  readonly label: string;
  readonly value: string;
  readonly threshold: string;
  /** A measure of nothing clears its threshold: it gives no evidence either way. */
  readonly clears: boolean;
}

const share = (label: string, fraction: Metrics.Fraction, atLeast: number): Measure => ({
  label,
  value: Report.text(fraction),
  threshold: `at least ${(100 * atLeast).toFixed(0)}%`,
  clears: fraction.of === 0 || fraction.right >= atLeast * fraction.of,
});

const count = (label: string, value: number, atMost: number): Measure => ({
  label,
  value: String(value),
  threshold: `at most ${atMost}`,
  clears: value <= atMost,
});

/** The headline numbers and course identity totals, each against the profile's threshold. */
export const measures = (
  measured: Measured,
  thresholds: SchoolProfile.Thresholds,
): ReadonlyArray<Measure> => [
  share("Student-weeks exactly right", measured.studentWeeks.weeks, thresholds.studentWeeks),
  share("Student lesson recall", measured.studentWeeks.recall, thresholds.recall),
  share("Student lesson precision", measured.studentWeeks.precision, thresholds.precision),
  share("Kurswahl exactly right", measured.kurswahl, thresholds.kurswahl),
  count("Real courses split", measured.courseIdentity.split, thresholds.split),
  count("Our courses merging real ones", measured.courseIdentity.merged, thresholds.merged),
  count("Courses no student chose", measured.ghostCourses, thresholds.ghostCourses),
];

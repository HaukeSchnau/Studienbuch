/**
 * What students see, as the harness and later the nightly self-check measure it: each student's
 * Kurswahl, taken from the lessons the import showed when the term began and then held, and the
 * courses nobody chose. A course the import splits or renames after the Kurswahl then shows as
 * missing lessons, not as a new choice. Only entries and our lessons go in, never a corpus.
 */
import { CivilTime } from "@stu/core";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { Metrics } from "./Metrics.ts";
import type { Truth } from "./Truth.ts";

export * as Students from "./Students.ts";

const regular = <A extends { readonly status: string }>(rows: ReadonlyArray<A>) =>
  rows.filter(({ status }) => status !== "Added");

const decodeDate = Schema.decodeOption(CivilTime.PlainDate);

/** A teaching group in a term: its subjects, classes and the teachers the plan gives it. */
const groupOf = (entry: Metrics.TruthEntry, term: string | undefined) =>
  [
    term,
    entry.subjects.join("+"),
    entry.classes.join("+"),
    [...entry.plannedTeachers].sort((a, b) => a - b).join("+"),
  ].join("\n");

/** The weekly slot an entry meets in: its weekday, start and end. */
const slotOf = (entry: Metrics.TruthEntry) =>
  Option.map(
    decodeDate(entry.date),
    (date) => `${CivilTime.dayOfWeek(date)} ${entry.start} ${entry.end}`,
  );

/** A lesson of the plan that takes place: neither cancelled nor added. */
const planned = (entry: Metrics.TruthEntry) =>
  entry.status === "Regular" || entry.status === "Changed";

const overlap = (a: Metrics.TruthEntry, b: Metrics.TruthEntry) =>
  a.date === b.date && a.start < b.end && b.start < a.end;

/**
 * The views without the entries WebUntis shows beyond their group, such as a lesson without a
 * student group, which every student of its classes sees: an entry at the same time as a lesson
 * that takes place, of a group that met in other weekly slots while the student's view was shown,
 * none of which the student sees (m2-import-corpus.md, section 6).
 */
export const attended = (
  views: ReadonlyArray<Truth.View>,
  termOf: (date: string) => string | undefined,
): ReadonlyArray<Truth.View> => {
  const judged = (entry: Metrics.TruthEntry) =>
    entry.status !== "Added" && entry.subjects.length > 0;

  // Each group's slots, with the dates any student saw them on.
  const slots = new Map<string, Map<string, Set<string>>>();

  for (const entry of views.flatMap((view) => view.entries).filter(judged)) {
    const group = groupOf(entry, termOf(entry.date));

    for (const slot of Option.toArray(slotOf(entry))) {
      const ofGroup = slots.get(group) ?? new Map<string, Set<string>>();

      ofGroup.set(slot, (ofGroup.get(slot) ?? new Set<string>()).add(entry.date));
      slots.set(group, ofGroup);
    }
  }

  return views.map((view) => {
    const seen = new Map<string, Set<string>>();

    for (const entry of view.entries.filter(judged)) {
      const group = groupOf(entry, termOf(entry.date));

      for (const slot of Option.toArray(slotOf(entry))) {
        seen.set(group, (seen.get(group) ?? new Set<string>()).add(slot));
      }
    }

    const shown = (date: string) =>
      !view.hidden.has(date) &&
      Option.exists(decodeDate(date), (each) => view.weeks.has(CivilTime.isoWeek(each)));

    const beyond = (entry: Metrics.TruthEntry) => {
      const group = groupOf(entry, termOf(entry.date));
      const ofGroup = slots.get(group) ?? new Map<string, Set<string>>();

      const elsewhere = (slot: string) => (each: string) =>
        each !== slot && (ofGroup.get(each)?.size ?? 0) >= 2;

      return Option.match(slotOf(entry), {
        onNone: () => false,
        onSome: (slot) =>
          judged(entry) &&
          view.entries.some(
            (other) => other !== entry && planned(other) && overlap(entry, other),
          ) &&
          [...ofGroup].some(([each, dates]) => elsewhere(slot)(each) && [...dates].some(shown)) &&
          ![...(seen.get(group) ?? [])].some(elsewhere(slot)),
      });
    };

    return { ...view, entries: view.entries.filter((entry) => !beyond(entry)) };
  });
};

/** The courses a student chooses: those whose lessons in `index` cover their entries, added ones aside. */
export const kurswahl = (
  entries: ReadonlyArray<Metrics.TruthEntry>,
  index: ReadonlyMap<string, ReadonlyArray<Metrics.Lesson>>,
): ReadonlySet<string> => Metrics.enrollment(regular(entries), index);

/** A student's lessons: those of the courses their Kurswahl names. */
export const lessonsOf = (lessons: ReadonlyArray<Metrics.Lesson>, chosen: ReadonlySet<string>) =>
  lessons.filter(({ courseId }) => chosen.has(courseId));

/** Whether the lesson claims one of the entry's WebUntis ids, on its date, at its start and end. */
const matches = (lesson: Metrics.Lesson, entry: Metrics.TruthEntry) =>
  lesson.date === entry.date &&
  lesson.start === entry.start &&
  lesson.end === entry.end &&
  lesson.entries.some(
    (claim) => claim.date === entry.date && claim.ids.some((id) => entry.ids.includes(id)),
  );

/**
 * Whether the Kurswahl's lessons are exactly the student's entries, added ones aside: each entry
 * matched by one lesson and each lesson by some entry, so choosing courses gives them their week.
 */
export const isExact = (
  entries: ReadonlyArray<Metrics.TruthEntry>,
  lessons: ReadonlyArray<Metrics.Lesson>,
  chosen: ReadonlySet<string>,
) => {
  const expected = regular(entries);
  const mine = regular(lessonsOf(lessons, chosen));

  return (
    expected.every((entry) => mine.filter((lesson) => matches(lesson, entry)).length === 1) &&
    mine.every((lesson) => expected.some((entry) => matches(lesson, entry)))
  );
};

/** A student's timetable as WebUntis shows it: their entries, and the days it hid from the account. */
export interface View {
  readonly entries: ReadonlyArray<Metrics.TruthEntry>;
  readonly hidden: ReadonlySet<string>;
}

/**
 * A student's Kurswahl from their entries of the opening days, and whether those courses' lessons
 * on the opening days are exactly those entries.
 */
export const choose = (
  student: View,
  opening: (date: string) => boolean,
  store: {
    readonly lessons: ReadonlyArray<Metrics.Lesson>;
    readonly index: ReadonlyMap<string, ReadonlyArray<Metrics.Lesson>>;
  },
) => {
  const entries = student.entries.filter((entry) => opening(entry.date));
  const courses = kurswahl(entries, store.index);

  const lessons = store.lessons.filter(
    (lesson) => opening(lesson.date) && !student.hidden.has(lesson.date),
  );

  return { courses, exact: isExact(entries, lessons, courses) };
};

/** A student's week: their entries of it against the lessons their Kurswahl gives them, hidden days aside. */
export const week = (
  student: View,
  inWeek: (date: string) => boolean,
  lessons: ReadonlyArray<Metrics.Lesson>,
  chosen: ReadonlySet<string>,
) =>
  Metrics.scoreView(
    student.entries.filter((entry) => inWeek(entry.date)),
    lessonsOf(lessons, chosen).filter(
      (lesson) => inWeek(lesson.date) && !student.hidden.has(lesson.date),
    ),
  );

/**
 * The courses with lessons in some term that no Kurswahl of that term names, so no student sees
 * those lessons. A course chosen in one term is no excuse in another.
 */
export const ghosts = (
  terms: ReadonlyArray<{
    readonly lessons: ReadonlyArray<Metrics.Lesson>;
    readonly kurswahls: ReadonlyArray<ReadonlySet<string>>;
  }>,
) =>
  new Set(
    terms.flatMap(({ lessons, kurswahls }) => {
      const chosen = new Set(kurswahls.flatMap((each) => [...each]));

      return lessons.flatMap(({ courseId }) => (chosen.has(courseId) ? [] : [courseId]));
    }),
  ).size;

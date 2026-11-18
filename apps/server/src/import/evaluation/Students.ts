/**
 * What students see, as the harness and later the nightly self-check measure it: each student's
 * Kurswahl, taken from the lessons the import showed when the term began and then held, and the
 * courses nobody chose. A course the import splits or renames after the Kurswahl then shows as
 * missing lessons, not as a new choice. Only entries and our lessons go in, never a corpus.
 */
import { Metrics } from "./Metrics.ts";

export * as Students from "./Students.ts";

const regular = <A extends { readonly status: string }>(rows: ReadonlyArray<A>) =>
  rows.filter(({ status }) => status !== "Added");

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

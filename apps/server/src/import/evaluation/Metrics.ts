/**
 * The harness's measures as pure functions over the truth and our rows (m2-import-corpus.md,
 * section 6, "Metrics"). Our lesson covers a truth entry when they share the date and at least
 * one WebUntis id. Teachers and rooms compare as WebUntis ids, ours resolved through `links`.
 */
import * as Equal from "effect/Equal";
import type { SchoolImport } from "../SchoolImport.ts";

export * as Metrics from "./Metrics.ts";

/** One timetable entry as WebUntis showed it last. */
export interface TruthEntry {
  readonly date: string;
  readonly ids: ReadonlyArray<number>;
  readonly start: number;
  readonly end: number;
  readonly status: SchoolImport.LessonStatus;
  readonly teachers: ReadonlyArray<number>;
  readonly rooms: ReadonlyArray<number>;
  readonly previousTeachers: ReadonlyArray<number>;
  readonly previousRooms: ReadonlyArray<number>;
}

/** One of our lessons, in the truth's terms. */
export interface Lesson extends Omit<TruthEntry, "ids"> {
  readonly id: string;
  readonly courseId: string;
  readonly kind: SchoolImport.ChangeKind | undefined;
  /** The entries its links claim. */
  readonly entries: ReadonlyArray<{ readonly date: string; readonly ids: ReadonlyArray<number> }>;
}

/** `right` of `of`, kept as two counts so a baseline compares exactly. */
export interface Fraction {
  readonly right: number;
  readonly of: number;
}

export const fraction = (right: number, of: number): Fraction => ({ right, of });

export const add = (a: Fraction, b: Fraction): Fraction => fraction(a.right + b.right, a.of + b.of);

const ascending = (a: number, b: number) => a - b;

const sameSet = (a: ReadonlyArray<number>, b: ReadonlyArray<number>) =>
  Equal.equals([...a].sort(ascending), [...b].sort(ascending));

export const covers = (lesson: Lesson, entry: TruthEntry) =>
  lesson.entries.some(
    (claimed) => claimed.date === entry.date && claimed.ids.some((id) => entry.ids.includes(id)),
  );

const byId = (a: Lesson, b: Lesson) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** The first of our lessons, by id, that covers each truth entry it covers first. */
const claim = (truth: ReadonlyArray<TruthEntry>, ours: ReadonlyArray<Lesson>) => {
  const claimed = new Map<TruthEntry, Lesson>();
  let precise = 0;

  for (const lesson of [...ours].sort(byId)) {
    const fresh = truth.filter((entry) => !claimed.has(entry) && covers(lesson, entry));

    for (const entry of fresh) claimed.set(entry, lesson);

    if (fresh.length > 0) precise += 1;
  }

  return { claimed, precise };
};

export const sameAttributes = (lesson: Lesson, entry: TruthEntry) =>
  lesson.start === entry.start &&
  lesson.end === entry.end &&
  lesson.status === entry.status &&
  sameSet(lesson.teachers, entry.teachers) &&
  sameSet(lesson.rooms, entry.rooms);

/** One view's week: how many truth entries we cover, how many lessons cover one, how many match. */
export interface ViewWeek {
  readonly truth: number;
  readonly ours: number;
  readonly covered: number;
  /** Lessons that cover an entry no earlier lesson covered, so a doubled lesson isn't precise. */
  readonly precise: number;
  /** Covered entries whose lesson has the same start, end, status, teachers and rooms. */
  readonly right: number;
}

export const scoreView = (
  truth: ReadonlyArray<TruthEntry>,
  ours: ReadonlyArray<Lesson>,
): ViewWeek => {
  const { claimed, precise } = claim(truth, ours);
  const right = [...claimed].filter(([entry, lesson]) => sameAttributes(lesson, entry)).length;

  return { truth: truth.length, ours: ours.length, covered: claimed.size, precise, right };
};

/** Recall and precision 100% and every attribute right. */
export const isExact = (week: ViewWeek) =>
  week.covered === week.truth && week.precise === week.ours && week.right === week.truth;

/** Weeks exactly right, recall, precision and attributes over many view-weeks. */
export const summarize = (weeks: ReadonlyArray<ViewWeek>) => ({
  weeks: fraction(weeks.filter(isExact).length, weeks.length),
  recall: fraction(sum(weeks, "covered"), sum(weeks, "truth")),
  precision: fraction(sum(weeks, "precise"), sum(weeks, "ours")),
  attributes: fraction(sum(weeks, "right"), sum(weeks, "covered")),
});

const sum = (weeks: ReadonlyArray<ViewWeek>, field: keyof ViewWeek) =>
  weeks.reduce((total, week) => total + week[field], 0);

/** A student's courses: those whose lessons cover the student's entries. */
export const enrollment = (
  entries: ReadonlyArray<TruthEntry>,
  ours: ReadonlyArray<Lesson>,
): ReadonlySet<string> =>
  new Set(
    ours.flatMap((lesson) =>
      entries.some((entry) => covers(lesson, entry)) ? [lesson.courseId] : [],
    ),
  );

export interface LabelledChange {
  readonly id: string;
  readonly date: string;
  readonly entryIds: ReadonlyArray<number>;
  readonly kind: SchoolImport.ChangeKind;
}

/**
 * Changed, cancelled and added entries whose first covering lesson has their status, previous
 * teachers and rooms, and their labelled kind when a case labels one.
 */
export const scoreChanges = (
  changes: ReadonlyArray<TruthEntry>,
  labels: ReadonlyArray<LabelledChange>,
  ours: ReadonlyArray<Lesson>,
) => {
  const labelOf = (entry: TruthEntry) =>
    labels.find(
      (label) => label.date === entry.date && label.entryIds.some((id) => entry.ids.includes(id)),
    );

  const isRight = (entry: TruthEntry) => {
    const lesson = [...ours].sort(byId).find((each) => covers(each, entry));
    const label = labelOf(entry);

    return (
      lesson !== undefined &&
      lesson.status === entry.status &&
      sameSet(lesson.previousTeachers, entry.previousTeachers) &&
      sameSet(lesson.previousRooms, entry.previousRooms) &&
      (label === undefined || lesson.kind === label.kind)
    );
  };

  const right = changes.filter(isRight);

  return {
    score: fraction(right.length, changes.length),
    passing: labels.flatMap((label) =>
      right.some((entry) => labelOf(entry) === label) ? [label.id] : [],
    ),
  };
};

/** School days on which we're closed exactly when the truth is. */
export const scoreClosures = (
  days: ReadonlyArray<string>,
  closedInTruth: (day: string) => boolean,
  closedInOurs: (day: string) => boolean,
): Fraction =>
  fraction(days.filter((day) => closedInTruth(day) === closedInOurs(day)).length, days.length);

/**
 * Courses that meet in some evaluated weeks but not all, and whose weeks all carry one of our
 * labels. A course that meets every other week must always meet in weeks with the same label.
 */
export const scoreAlternation = (
  ours: ReadonlyArray<Lesson>,
  weekOf: (date: string) => string,
  weeks: ReadonlyArray<string>,
  labelOf: (week: string) => string | undefined,
): Fraction => {
  const met = new Map<string, Set<string>>();

  for (const lesson of ours) {
    const week = weekOf(lesson.date);

    if (weeks.includes(week))
      met.set(lesson.courseId, (met.get(lesson.courseId) ?? new Set()).add(week));
  }

  const alternating = [...met.values()].filter((each) => each.size < weeks.length);

  return fraction(
    alternating.filter((each) => {
      const labels = new Set([...each].map(labelOf));

      return labels.size === 1 && !labels.has(undefined);
    }).length,
    alternating.length,
  );
};

export interface TruthExam {
  readonly id: number;
  readonly date: string;
  readonly start: number;
  readonly end: number;
  readonly students: ReadonlyArray<number>;
}

export interface Exam {
  readonly courseId: string;
  readonly date: string;
  readonly start: number;
  readonly end: number;
  /** The WebUntis exams its links claim. */
  readonly examIds: ReadonlyArray<number>;
}

/**
 * Per exam: our exam has its date and time, and is shown to exactly its students. Per student
 * and exam: the exams a student sees through the courses they take, against the exam's students.
 */
export const scoreExams = (
  truth: ReadonlyArray<TruthExam>,
  ours: ReadonlyArray<Exam>,
  enrollments: ReadonlyMap<number, ReadonlySet<string>>,
) => {
  const shownTo = (exam: Exam) =>
    [...enrollments].flatMap(([student, courses]) => (courses.has(exam.courseId) ? [student] : []));

  const shown = ours.flatMap((exam) =>
    shownTo(exam).map((student) => ({ student, examIds: exam.examIds })),
  );

  const truthPairs = truth.flatMap((exam) =>
    exam.students.map((student) => ({ student, id: exam.id })),
  );

  const isShown = (pair: { readonly student: number; readonly id: number }) =>
    shown.some((each) => each.student === pair.student && each.examIds.includes(pair.id));

  const rightExams = truth.filter((exam) =>
    ours.some(
      (each) =>
        each.examIds.includes(exam.id) &&
        each.date === exam.date &&
        each.start === exam.start &&
        each.end === exam.end &&
        sameSet(shownTo(each), exam.students),
    ),
  );

  const rightShown = shown.filter((each) =>
    truthPairs.some((pair) => pair.student === each.student && each.examIds.includes(pair.id)),
  );

  return {
    exams: fraction(rightExams.length, truth.length),
    students: {
      recall: fraction(truthPairs.filter(isShown).length, truthPairs.length),
      precision: fraction(rightShown.length, shown.length),
    },
  };
};

/**
 * Of the truth entries both states cover, those whose first covering lesson moved to another
 * course id. Homework and enrollments name a course, so a changed id loses them.
 */
export const courseChurn = (
  truth: ReadonlyArray<TruthEntry>,
  before: ReadonlyArray<Lesson>,
  after: ReadonlyArray<Lesson>,
): Fraction => {
  const firstBefore = claim(truth, before).claimed;
  const firstAfter = claim(truth, after).claimed;
  const both = truth.filter((entry) => firstBefore.has(entry) && firstAfter.has(entry));

  return fraction(
    both.filter((entry) => firstBefore.get(entry)?.courseId !== firstAfter.get(entry)?.courseId)
      .length,
    both.length,
  );
};

type Rows = Pick<
  SchoolImport.ImportResult,
  "courses" | "lessons" | "closures" | "exams" | "teachers" | "rooms"
>;

const rowsOf = (state: Rows) =>
  new Map<string, unknown>(
    [
      state.courses,
      state.lessons,
      state.closures,
      state.exams,
      state.teachers,
      state.rooms,
    ].flatMap((rows) => rows.map((row): [string, unknown] => [row.id, row])),
  );

/** Rows that are in one state and not the other, or differ between them. */
export const differences = (a: Rows, b: Rows) => {
  const left = rowsOf(a);
  const right = rowsOf(b);

  return [...new Set([...left.keys(), ...right.keys()])].filter(
    (id) => !left.has(id) || !right.has(id) || !Equal.equals(left.get(id), right.get(id)),
  ).length;
};

/** Rows of `before` that `after` lacks. */
export const deleted = (before: Rows, after: Rows) => {
  const kept = rowsOf(after);

  return [...rowsOf(before).keys()].filter((id) => !kept.has(id)).length;
};

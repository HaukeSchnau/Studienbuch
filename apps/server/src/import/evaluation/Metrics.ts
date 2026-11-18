/**
 * The harness's measures as pure functions over the truth and our rows (m2-import-corpus.md,
 * section 6, "Metrics"). Our lesson covers a truth entry when they share the date and at least
 * one WebUntis id. Teachers and rooms compare as WebUntis ids, ours resolved through `links`.
 */
import * as Arr from "effect/Array";
import * as Equal from "effect/Equal";
import { SchoolImport } from "../SchoolImport.ts";

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

export const sum = (fractions: ReadonlyArray<Fraction>) => fractions.reduce(add, fraction(0, 0));

const ascending = (a: number, b: number) => a - b;

const sameSet = (a: ReadonlyArray<number>, b: ReadonlyArray<number>) =>
  Equal.equals([...a].sort(ascending), [...b].sort(ascending));

/** Lessons by the entries they claim, each list in order of lesson ids. */
export const byEntry = (
  ours: ReadonlyArray<Lesson>,
): ReadonlyMap<string, ReadonlyArray<Lesson>> => {
  const index = new Map<string, Array<Lesson>>();

  for (const lesson of Arr.sort(ours, SchoolImport.idOrder)) {
    for (const claimed of lesson.entries) {
      for (const id of claimed.ids) {
        const key = `${claimed.date} ${id}`;

        index.set(key, [...(index.get(key) ?? []), lesson]);
      }
    }
  }

  return index;
};

/** Our lessons that cover an entry, first by id. */
const covering = (
  index: ReadonlyMap<string, ReadonlyArray<Lesson>>,
  entry: { readonly date: string; readonly ids: ReadonlyArray<number> },
) =>
  Arr.sort(
    [...new Set(entry.ids.flatMap((id) => index.get(`${entry.date} ${id}`) ?? []))],
    SchoolImport.idOrder,
  );

/** The first of our lessons, by id, that covers each truth entry it covers first. */
const claim = (truth: ReadonlyArray<TruthEntry>, ours: ReadonlyArray<Lesson>) => {
  const entries = new Map<string, Array<TruthEntry>>();

  for (const entry of truth) {
    for (const id of entry.ids) {
      entries.set(`${entry.date} ${id}`, [...(entries.get(`${entry.date} ${id}`) ?? []), entry]);
    }
  }

  const claimed = new Map<TruthEntry, Lesson>();
  let precise = 0;

  for (const lesson of Arr.sort(ours, SchoolImport.idOrder)) {
    const fresh = new Set(
      lesson.entries.flatMap(({ date, ids }) =>
        ids.flatMap((id) => (entries.get(`${date} ${id}`) ?? []).filter((e) => !claimed.has(e))),
      ),
    );

    for (const entry of fresh) claimed.set(entry, lesson);

    if (fresh.size > 0) precise += 1;
  }

  return { claimed, precise };
};

export const sameAttributes = (lesson: Lesson, entry: TruthEntry) =>
  lesson.date === entry.date &&
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
  /** Covered entries whose lesson has the same date, start, end, status, teachers and rooms. */
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

const total = (weeks: ReadonlyArray<ViewWeek>, field: keyof ViewWeek) =>
  weeks.reduce((count, week) => count + week[field], 0);

/** Weeks exactly right, recall, precision and attributes over many view-weeks. */
export const summarize = (weeks: ReadonlyArray<ViewWeek>) => ({
  weeks: fraction(weeks.filter(isExact).length, weeks.length),
  recall: fraction(total(weeks, "covered"), total(weeks, "truth")),
  precision: fraction(total(weeks, "precise"), total(weeks, "ours")),
  attributes: fraction(total(weeks, "right"), total(weeks, "covered")),
});

/** A student's courses: those whose lessons cover the student's entries. */
export const enrollment = (
  entries: ReadonlyArray<TruthEntry>,
  index: ReadonlyMap<string, ReadonlyArray<Lesson>>,
): ReadonlySet<string> =>
  new Set(entries.flatMap((entry) => covering(index, entry).map((lesson) => lesson.courseId)));

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
  index: ReadonlyMap<string, ReadonlyArray<Lesson>>,
) => {
  const labelOf = (entry: TruthEntry) =>
    labels.find(
      (label) => label.date === entry.date && label.entryIds.some((id) => entry.ids.includes(id)),
    );

  const isRight = (entry: TruthEntry) => {
    const lesson = covering(index, entry)[0];
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

export interface LabelledCourse {
  readonly id: string;
  /** Whether the entries belong to one course, or to as many courses as there are entries. */
  readonly same: boolean;
  readonly entries: ReadonlyArray<{ readonly date: string; readonly ids: ReadonlyArray<number> }>;
}

/** Labelled sets of entries whose first covering lessons share one course, or don't. */
export const scoreCourses = (
  cases: ReadonlyArray<LabelledCourse>,
  index: ReadonlyMap<string, ReadonlyArray<Lesson>>,
) => {
  const passing = cases.filter((labelled) => {
    const courses = labelled.entries.map(
      (entry) => covering(index, entry)[0]?.courseId ?? "not imported",
    );

    const distinct = new Set(courses).size;

    return (
      !courses.includes("not imported") &&
      (labelled.same ? distinct === 1 : distinct === courses.length)
    );
  });

  return {
    score: fraction(passing.length, cases.length),
    passing: passing.map((labelled) => labelled.id),
  };
};

/** Closed school days: those we close of the truth's, and those of ours that the truth closes. */
export const scoreClosures = (
  days: ReadonlyArray<string>,
  closedInTruth: (day: string) => boolean,
  closedInOurs: (day: string) => boolean,
) => {
  const truth = days.filter(closedInTruth);
  const ours = days.filter(closedInOurs);

  return {
    recall: fraction(truth.filter(closedInOurs).length, truth.length),
    precision: fraction(ours.filter(closedInTruth).length, ours.length),
  };
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
 * A truth pair credits one shown exam only, so a doubled exam isn't precise.
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

  const truthPairs = new Set(
    truth.flatMap((exam) => exam.students.map((student) => `${student} ${exam.id}`)),
  );

  const credited = new Set<string>();

  for (const each of shown) {
    const pair = each.examIds
      .map((id) => `${each.student} ${id}`)
      .find((key) => truthPairs.has(key) && !credited.has(key));

    if (pair !== undefined) credited.add(pair);
  }

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

  return {
    exams: fraction(rightExams.length, truth.length),
    students: {
      recall: fraction(credited.size, truthPairs.size),
      precision: fraction(credited.size, shown.length),
    },
  };
};

/**
 * Of the truth entries the later run read again, those whose first covering lesson kept its
 * course id. Homework and enrollments name a course, so a changed id loses them.
 */
export const courseIdsKept = (
  reread: ReadonlyArray<TruthEntry>,
  before: ReadonlyMap<string, ReadonlyArray<Lesson>>,
  after: ReadonlyMap<string, ReadonlyArray<Lesson>>,
): Fraction => {
  const both = reread.flatMap((entry) => {
    const was = covering(before, entry)[0];
    const is = covering(after, entry)[0];

    return was === undefined || is === undefined ? [] : [was.courseId === is.courseId];
  });

  return fraction(both.filter((kept) => kept).length, both.length);
};

/** Our lessons' claims of WebUntis entries that the truth holds. A wrong link is an error. */
export const scoreLinks = (
  ours: ReadonlyArray<Lesson>,
  truth: ReadonlyArray<TruthEntry>,
  measured: (date: string) => boolean,
): Fraction => {
  const known = new Set(truth.flatMap((entry) => entry.ids.map((id) => `${entry.date} ${id}`)));
  const claims = ours.flatMap((lesson) => lesson.entries).filter(({ date }) => measured(date));

  return fraction(
    claims.filter(({ date, ids }) => ids.every((id) => known.has(`${date} ${id}`))).length,
    claims.length,
  );
};

type State = Pick<
  SchoolImport.ImportResult,
  "courses" | "lessons" | "closures" | "exams" | "teachers" | "rooms" | "weeks" | "links"
>;

// Ids are unique within a kind only, so each entry is keyed by its kind as well.
const contentsOf = (state: State) =>
  new Map<string, unknown>(
    (
      [
        ["course", state.courses],
        ["lesson", state.lessons],
        ["closure", state.closures],
        ["exam", state.exams],
        ["teacher", state.teachers],
        ["room", state.rooms],
        ["link", state.links],
      ] as const
    )
      .flatMap(([kind, rows]) =>
        rows.map((row: { readonly id: string }): [string, unknown] => [`${kind} ${row.id}`, row]),
      )
      .concat(state.weeks.map((week): [string, unknown] => [`week ${week.week}`, week])),
  );

/** Rows, week labels and links that are in one state and not the other, or differ. */
export const differences = (a: State, b: State) => {
  const left = contentsOf(a);
  const right = contentsOf(b);

  return [...new Set([...left.keys(), ...right.keys()])].filter(
    (key) => !left.has(key) || !right.has(key) || !Equal.equals(left.get(key), right.get(key)),
  ).length;
};

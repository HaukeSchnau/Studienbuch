/**
 * The import's seam (m2-import-corpus.md, section 6). An import reads WebUntis only through
 * webuntis-api's `WebUntisClient` and returns an `ImportResult`, so the evaluation harness swaps in
 * a recorded client and measures any algorithm behind this seam the same way.
 */
import {
  CivilTime,
  Course,
  Lesson,
  School,
  SchoolClass,
  SchoolYear,
  Subject,
  Term,
} from "@stu/core";
import { Ids } from "@stu/sync";
import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";
import type { SchoolProfile } from "./profiles/SchoolProfile.ts";

export * as SchoolImport from "./SchoolImport.ts";

/** A date as WebUntis and stored rows write it, such as `2026-11-09`. */
export const Day = Schema.toEncoded(CivilTime.PlainDate);

export const ImportedSchoolYear = Schema.Struct({
  id: SchoolYear.Id,
  name: Schema.String,
  start: Day,
  end: Day,
});

export const ImportedTerm = Schema.Struct({
  id: Term.Id,
  schoolYearId: SchoolYear.Id,
  name: Schema.String,
  start: Day,
  end: Day,
});

export const ImportedSubject = Schema.Struct({
  id: Subject.Id,
  name: Schema.String,
  shortName: Schema.String,
});

/** A lasting class such as `11.2`. A grade level whose courses span it has none. */
export const ImportedClass = Schema.Struct({
  id: SchoolClass.Id,
  schoolYearId: SchoolYear.Id,
  name: Schema.String,
  gradeLevel: School.GradeLevel,
});

export const ImportedCourse = Schema.Struct({
  id: Course.Id,
  name: Schema.String,
  subjectId: Schema.optional(Subject.Id),
  /** A level label such as `E` or `G`. */
  level: Schema.optional(Schema.String),
});

/** Who may choose a course in one term, under `CourseOffering.idFor`. */
export const ImportedOffering = Schema.Struct({
  id: Ids.Id,
  courseId: Course.Id,
  termId: Term.Id,
  gradeLevels: Schema.Array(School.GradeLevel),
  /** Empty for every class of those grade levels. */
  classIds: Schema.Array(SchoolClass.Id),
  /** A student takes at most one course of an elective group. Absent for a required course. */
  groupKey: Schema.optional(Schema.String),
});

export type ImportedOffering = typeof ImportedOffering.Type;

export const ImportedLesson = Schema.Struct({
  id: Ids.Id,
  courseId: Course.Id,
  date: Day,
  start: CivilTime.TimeOfDay,
  end: CivilTime.TimeOfDay,
  teacherIds: Schema.Array(Ids.Id),
  roomIds: Schema.Array(Ids.Id),
  status: Lesson.Status,
  change: Schema.optional(
    Schema.Struct({
      kind: Lesson.ChangeKind,
      previousTeacherIds: Schema.Array(Ids.Id),
      previousRoomIds: Schema.Array(Ids.Id),
      /** WebUntis's text as it was. The projection keeps only a stock phrase. */
      text: Schema.optional(Schema.String),
    }),
  ),
});

export type ImportedLesson = typeof ImportedLesson.Type;

export const ImportedClosure = Schema.Struct({
  id: Ids.Id,
  name: Schema.String,
  start: Day,
  end: Day,
});

export const ImportedExam = Schema.Struct({
  id: Ids.Id,
  courseId: Course.Id,
  date: Day,
  start: CivilTime.TimeOfDay,
  end: CivilTime.TimeOfDay,
});

export const ImportedTeacher = Schema.Struct({
  id: Ids.Id,
  shortName: Schema.String,
  /** WebUntis's long name, the surname, where it says more than the short name. */
  displayName: Schema.optional(Schema.String),
});

export const ImportedRoom = Schema.Struct({ id: Ids.Id, name: Schema.String });

/** The label the product shows for an ISO week, such as `A` for `2026-W44`. */
export const ImportedWeek = Schema.Struct({ week: Schema.String, label: Schema.String });

/** What one of our rows came from at the provider. */
export const ProviderRef = Schema.TaggedUnion({
  /** A timetable entry: its date and its WebUntis ids. */
  Entry: { date: Day, ids: Schema.Array(Schema.Int) },
  Resource: {
    type: Schema.Literals(["CLASS", "TEACHER", "SUBJECT", "ROOM", "STUDENT"]),
    id: Schema.Int,
  },
  Exam: { id: Schema.Int },
  Holiday: { id: Schema.Int },
});

export type ProviderRef = typeof ProviderRef.Type;

/** Names one row of the result, so every id in a result is unique across its kinds of rows. */
export const ProviderLink = Schema.Struct({ id: Ids.Id, refs: Schema.Array(ProviderRef) });

/**
 * Rows of one kind that a run read completely between two dates: every view answered for every
 * day, named the resource asked for, and gave no error. Only rows inside a coverage may be
 * deleted, so a read that failed deletes nothing.
 */
export const Coverage = Schema.Struct({
  rows: Schema.Literals(["lessons", "closures", "exams"]),
  start: Day,
  end: Day,
});

export type Coverage = typeof Coverage.Type;

/**
 * An entry of a complete read that the import gave no course, such as one of a course a daytime
 * run doesn't know. A lesson it lacks may be this entry, so its day deletes no lesson.
 */
export const Unattributed = Schema.Struct({ date: Day, ids: Schema.Array(Schema.Int) });

/** Something the import noticed, such as a read that failed. Ids and codes only, never content. */
export const Diagnostic = Schema.Struct({ code: Schema.String, detail: Schema.String });

/** Rows in all but name, which the projection maps onto the School and Course spaces. */
export const ImportResult = Schema.Struct({
  schoolYears: Schema.Array(ImportedSchoolYear),
  terms: Schema.Array(ImportedTerm),
  subjects: Schema.Array(ImportedSubject),
  classes: Schema.Array(ImportedClass),
  courses: Schema.Array(ImportedCourse),
  offerings: Schema.Array(ImportedOffering),
  lessons: Schema.Array(ImportedLesson),
  closures: Schema.Array(ImportedClosure),
  exams: Schema.Array(ImportedExam),
  teachers: Schema.Array(ImportedTeacher),
  rooms: Schema.Array(ImportedRoom),
  weeks: Schema.Array(ImportedWeek),
  links: Schema.Array(ProviderLink),
  /** This run's own, never carried into the next. */
  covers: Schema.Array(Coverage),
  /** This run's own, never carried into the next. */
  unattributed: Schema.Array(Unattributed),
  diagnostics: Schema.Array(Diagnostic),
});

export type ImportResult = typeof ImportResult.Type;

export const empty: ImportResult = {
  schoolYears: [],
  terms: [],
  subjects: [],
  classes: [],
  courses: [],
  offerings: [],
  lessons: [],
  closures: [],
  exams: [],
  teachers: [],
  rooms: [],
  weeks: [],
  links: [],
  covers: [],
  unattributed: [],
  diagnostics: [],
};

export interface ImportInput {
  /** The school, and what the import needs to know about it beyond WebUntis. */
  readonly profile: SchoolProfile.SchoolProfile;
  /** When the snapshot's first read was sent. */
  readonly now: DateTime.Utc;
  /** The days the run reads: today to four weeks ahead at the school. Nothing before is changed. */
  readonly window: CivilTime.DateRange;
  /** What the last run left, so ids stay stable. Covers and unattributed entries are empty. */
  readonly previous: Option.Option<ImportResult>;
  /**
   * Whether this is the nightly run, which alone creates courses and offerings. A daytime run
   * updates the lessons of courses `previous` knows and leaves any other entry unattributed.
   */
  readonly nightly: boolean;
}

/** The run read nothing it could use, so the store stays as it was. */
export class ImportFailed extends Schema.TaggedError<
  ImportFailed,
  { readonly brand: unique symbol }
>()("SchoolImport.ImportFailed", { reason: Schema.String }) {}

/** Its layer needs `WebUntisClient` and nothing else from outside. */
export class Service extends Context.Service<
  Service,
  { readonly run: (input: ImportInput) => Effect.Effect<ImportResult, ImportFailed> }
>()("SchoolImport.Service") {}

/** Rows in order of their ids. */
export const idOrder = Order.mapInput(Order.String, (row: { readonly id: string }) => row.id);

const byId = <A extends { readonly id: string }>(
  kept: ReadonlyArray<A>,
  incoming: ReadonlyArray<A>,
): ReadonlyArray<A> =>
  Arr.sort([...new Map([...kept, ...incoming].map((row) => [row.id, row])).values()], idOrder);

/**
 * Whether `result` is evidence that a row of `rows` from `start` to `end` is gone when it lacks
 * the row: one of its covers holds the whole range, and for lessons no entry of those days went
 * unattributed.
 */
export const deletes = (
  result: Pick<ImportResult, "covers" | "unattributed">,
  rows: Coverage["rows"],
  start: string,
  end = start,
) =>
  result.covers.some((cover) => cover.rows === rows && cover.start <= start && end <= cover.end) &&
  (rows !== "lessons" || !result.unattributed.some(({ date }) => start <= date && date <= end));

const union =
  <A>(order: Order.Order<A>) =>
  (a: ReadonlyArray<A>, b: ReadonlyArray<A>) =>
    Arr.sort(Arr.dedupe([...a, ...b]), order);

/**
 * The elective group of a course a student may take or leave, alone in its group: the app shows
 * it as a box to tick.
 */
export const ownGroup = (courseId: Course.Id) => courseId;

/**
 * An offering as it stands once `incoming` lands on what was published. Grade levels and classes
 * only grow, no classes stays every class, and the elective group stays, so an accepted choice
 * stays accepted. A required course may still become a choice of its own, which breaks no choice.
 */
export const widen = (
  kept: ImportedOffering | undefined,
  incoming: ImportedOffering,
): ImportedOffering => {
  if (kept === undefined) return incoming;

  const { groupKey, ...rest } = incoming;

  const widened = {
    ...rest,
    gradeLevels: union<School.GradeLevel>(Order.Number)(kept.gradeLevels, incoming.gradeLevels),
    classIds:
      kept.classIds.length === 0 || incoming.classIds.length === 0
        ? []
        : union<SchoolClass.Id>(Order.String)(kept.classIds, incoming.classIds),
  };

  const own = groupKey === ownGroup(incoming.courseId) ? groupKey : undefined;
  const group = kept.groupKey ?? own;

  return group === undefined ? widened : { ...widened, groupKey: group };
};

/**
 * What the store holds once `result` lands on `state`. A row of `state` that `result` lacks goes
 * only where {@link deletes} says so, every row of the result is added or updated by id, and
 * offerings only {@link widen}. Rows come out sorted by id, so the order of reads can't show.
 */
export const apply = (state: ImportResult, result: ImportResult): ImportResult => {
  const lessons = byId(
    state.lessons.filter((lesson) => !deletes(result, "lessons", lesson.date)),
    result.lessons,
  );

  const closures = byId(
    state.closures.filter((closure) => !deletes(result, "closures", closure.start, closure.end)),
    result.closures,
  );

  const exams = byId(
    state.exams.filter((exam) => !deletes(result, "exams", exam.date)),
    result.exams,
  );

  const published = new Map(state.offerings.map((offering) => [offering.id, offering]));

  const offerings = byId(
    state.offerings,
    result.offerings.map((offering) => widen(published.get(offering.id), offering)),
  );

  const kept = {
    schoolYears: byId(state.schoolYears, result.schoolYears),
    terms: byId(state.terms, result.terms),
    subjects: byId(state.subjects, result.subjects),
    classes: byId(state.classes, result.classes),
    courses: byId(state.courses, result.courses),
    offerings,
    lessons,
    closures,
    exams,
    teachers: byId(state.teachers, result.teachers),
    rooms: byId(state.rooms, result.rooms),
  };

  const rowIds = new Set(Object.values(kept).flatMap((rows) => rows.map((row) => row.id)));

  const weeks = Arr.sort(
    [...new Map([...state.weeks, ...result.weeks].map((week) => [week.week, week])).values()],
    Order.mapInput(Order.String, (week: typeof ImportedWeek.Type) => week.week),
  );

  return {
    ...kept,
    weeks,
    links: byId(state.links, result.links).filter((link) => rowIds.has(link.id)),
    covers: [],
    unattributed: [],
    diagnostics: result.diagnostics,
  };
};

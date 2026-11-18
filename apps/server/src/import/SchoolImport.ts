/**
 * The import's seam (m2-import-corpus.md, section 6). An import reads WebUntis only through
 * webuntis-api's `WebUntisClient` and returns an `ImportResult`, so the evaluation harness swaps in
 * a recorded client and measures any algorithm behind this seam the same way.
 */
import type { School } from "@stu/core";
import { CivilTime, Course } from "@stu/core";
import { Ids } from "@stu/sync";
import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";

export * as SchoolImport from "./SchoolImport.ts";

/** A date as WebUntis and stored rows write it, such as `2026-11-09`. */
export const Day = Schema.toEncoded(CivilTime.PlainDate);

/** Milliseconds since midnight (ADR 0001). */
export const TimeOfDay = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 86_400_000 }));

export const LessonStatus = Schema.Literals(["Regular", "Changed", "Cancelled", "Added"]);

export type LessonStatus = typeof LessonStatus.Type;

/** What changed about a lesson (domain.md, section 2.2). `Other` shows the provider's text. */
export const ChangeKind = Schema.Literals([
  "Cancelled",
  "Substitution",
  "Released",
  "Supervised",
  "RoomChange",
  "Moved",
  "Other",
]);

export type ChangeKind = typeof ChangeKind.Type;

export const ImportedCourse = Schema.Struct({
  id: Course.Id,
  name: Schema.String,
  /** The subject code, such as `MA`, when the import knows it. */
  subject: Schema.optional(Schema.String),
  /** A level label such as `E` or `G`. */
  level: Schema.optional(Schema.String),
});

export const ImportedLesson = Schema.Struct({
  id: Ids.Id,
  courseId: Course.Id,
  date: Day,
  start: TimeOfDay,
  end: TimeOfDay,
  teacherIds: Schema.Array(Ids.Id),
  roomIds: Schema.Array(Ids.Id),
  status: LessonStatus,
  change: Schema.optional(
    Schema.Struct({
      kind: ChangeKind,
      previousTeacherIds: Schema.Array(Ids.Id),
      previousRoomIds: Schema.Array(Ids.Id),
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
  start: TimeOfDay,
  end: TimeOfDay,
});

export const ImportedTeacher = Schema.Struct({ id: Ids.Id, shortName: Schema.String });

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

export const ProviderLink = Schema.Struct({ id: Ids.Id, refs: Schema.Array(ProviderRef) });

/**
 * Rows of one kind that a run read completely between two dates. Only rows inside a coverage may
 * be deleted, so a read that failed deletes nothing.
 */
export const Coverage = Schema.Struct({
  rows: Schema.Literals(["lessons", "closures", "exams"]),
  start: Day,
  end: Day,
});

export type Coverage = typeof Coverage.Type;

/** Something the import noticed, such as a read that failed. Ids and codes only, never content. */
export const Diagnostic = Schema.Struct({ code: Schema.String, detail: Schema.String });

/** Rows in all but name: M2.4 maps them onto the School and Course spaces. */
export const ImportResult = Schema.Struct({
  courses: Schema.Array(ImportedCourse),
  lessons: Schema.Array(ImportedLesson),
  closures: Schema.Array(ImportedClosure),
  exams: Schema.Array(ImportedExam),
  teachers: Schema.Array(ImportedTeacher),
  rooms: Schema.Array(ImportedRoom),
  weeks: Schema.Array(ImportedWeek),
  links: Schema.Array(ProviderLink),
  covers: Schema.Array(Coverage),
  diagnostics: Schema.Array(Diagnostic),
});

export type ImportResult = typeof ImportResult.Type;

export const empty: ImportResult = {
  courses: [],
  lessons: [],
  closures: [],
  exams: [],
  teachers: [],
  rooms: [],
  weeks: [],
  links: [],
  covers: [],
  diagnostics: [],
};

export interface ImportInput {
  readonly school: School.Id;
  /** The import's clock. It chooses its windows from it. */
  readonly now: DateTime.Utc;
  /** What the store holds after the last run, so ids stay stable. */
  readonly previous: Option.Option<ImportResult>;
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
 * What the store holds once `result` lands on `state`. Rows of a kind that touch one of the
 * result's coverages are replaced, every other row of the result is added or updated by id, and
 * nothing else is deleted. Rows come out sorted by id, so the order of reads can't show.
 */
export const apply = (state: ImportResult, result: ImportResult): ImportResult => {
  const covered = (rows: Coverage["rows"], start: string, end = start) =>
    result.covers.some((cover) => cover.rows === rows && cover.start <= end && start <= cover.end);

  const lessons = byId(
    state.lessons.filter((lesson) => !covered("lessons", lesson.date)),
    result.lessons,
  );

  const closures = byId(
    state.closures.filter((closure) => !covered("closures", closure.start, closure.end)),
    result.closures,
  );

  const exams = byId(
    state.exams.filter((exam) => !covered("exams", exam.date)),
    result.exams,
  );

  const courses = byId(state.courses, result.courses);
  const teachers = byId(state.teachers, result.teachers);
  const rooms = byId(state.rooms, result.rooms);

  const rowIds = new Set(
    [lessons, closures, exams, courses, teachers, rooms].flatMap((rows) => rows.map((r) => r.id)),
  );

  const weeks = Arr.sort(
    [...new Map([...state.weeks, ...result.weeks].map((week) => [week.week, week])).values()],
    Order.mapInput(Order.String, (week: typeof ImportedWeek.Type) => week.week),
  );

  const covers = [
    ...new Map(
      [...state.covers, ...result.covers].map((cover) => [
        `${cover.rows} ${cover.start} ${cover.end}`,
        cover,
      ]),
    ).values(),
  ];

  return {
    courses,
    lessons,
    closures,
    exams,
    teachers,
    rooms,
    weeks,
    links: byId(state.links, result.links).filter((link) => rowIds.has(link.id)),
    covers,
    diagnostics: result.diagnostics,
  };
};

import {
  CivilTime,
  Closure,
  Course,
  Enrollment,
  ImportStatus,
  Lesson,
  Notebook,
  Room,
  Subject,
  Teacher,
  Term,
  Timetable,
  WeekLabel,
} from "@stu/core";
import type { AgendaItem } from "@stu/domain-ui/timetable/AgendaItem";
import { DeviceDatabase, DeviceSchema, SyncQuery } from "@stu/sync/client";
import { eq, gte } from "drizzle-orm";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";
import * as Struct from "effect/Struct";

import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Schema as Device } from "../../infra/sqlite/Schema.ts";

// The school's timetable as the device holds it, for the Übersicht's card, Meine Woche and the
// lesson sheet: the student's lessons from a date on with their courses, and the school's teachers,
// rooms, closures, week labels and Stand.

export * as TimetableState from "./TimetableState.ts";

const runtime = Atom.family((accountId: string) => Atom.runtime(AccountEngine.app(accountId)));

/** What the device holds of the timetable. */
export interface Reading {
  readonly plan: Timetable.Plan<AgendaItem.Source>;
  readonly names: AgendaItem.Names;
  /** When the import last read the school, in epoch milliseconds. `None` without a Stand. */
  readonly observedAt: Option.Option<number>;
  /** The school's label of a week, such as "A", by ISO week (`CivilTime.isoWeek`). */
  readonly weekLabels: ReadonlyMap<string, string>;
}

const decode = {
  notebook: DeviceSchema.decodeView(Notebook.Row),
  course: DeviceSchema.decodeView(Course.Row),
  subject: DeviceSchema.decodeView(Subject.Row),
  teacher: DeviceSchema.decodeView(Teacher.Row),
  room: DeviceSchema.decodeView(Room.Row),
  closure: DeviceSchema.decodeView(Closure.Row),
  status: DeviceSchema.decodeView(ImportStatus.Row),
  lesson: DeviceSchema.decodeView(Lesson.Row),
  term: DeviceSchema.decodeView(Term.Row),
  enrollment: DeviceSchema.decodeView(Enrollment.Row),
  weekLabel: DeviceSchema.decodeView(WeekLabel.Row),
};

/**
 * The device receives the Course spaces of every course its notebook ever chose
 * (`Enrollment.courseMembership`), so a lesson counts only when its course is chosen for the term
 * of its date. Lessons are read from `from` on (as `CivilTime.format` writes it), and the school's
 * other rows whole, as a school holds a few hundred of them at most.
 */
const read = Effect.fn("TimetableState.read")(function* (from: string) {
  const db = yield* DeviceDatabase.make;
  const [notebook] = yield* Effect.flatMap(db.select().from(Device.Notebook), decode.notebook);

  if (notebook === undefined) return Option.none<Reading>();

  const inSchool = <A extends { readonly space: string }>(rows: ReadonlyArray<A>) =>
    rows.filter((row) => row.space === notebook.schoolId);

  const courses = inSchool(yield* Effect.flatMap(db.select().from(Device.Course), decode.course));

  const subjects = new Map(
    inSchool(yield* Effect.flatMap(db.select().from(Device.Subject), decode.subject)).map((row) => [
      row.id,
      row,
    ]),
  );

  const teachers = inSchool(
    yield* Effect.flatMap(db.select().from(Device.Teacher), decode.teacher),
  );

  const rooms = inSchool(yield* Effect.flatMap(db.select().from(Device.Room), decode.room));

  const closures = inSchool(
    yield* Effect.flatMap(db.select().from(Device.Closure), decode.closure),
  );

  const status = inSchool(
    yield* Effect.flatMap(db.select().from(Device.ImportStatus), decode.status),
  ).find((row) => row.id === notebook.schoolId);

  const lessons = yield* Effect.flatMap(
    db.select().from(Device.Lesson).where(gte(Device.Lesson.date, from)),
    decode.lesson,
  );

  const terms = inSchool(yield* Effect.flatMap(db.select().from(Device.Term), decode.term)).map(
    (row) => ({ id: row.id, row: Struct.omit(row, ["space", "id"]) }),
  );

  const enrollments = (yield* Effect.flatMap(
    db.select().from(Device.Enrollment),
    decode.enrollment,
  )).filter((row) => row.space === notebook.id);

  const weekLabels = inSchool(
    yield* Effect.flatMap(db.select().from(Device.WeekLabel), decode.weekLabel),
  );

  const chosen = (lesson: Lesson.Row) =>
    Enrollment.chosenOn(enrollments, terms, lesson.date).includes(lesson.courseId);

  const named = new Map(courses.map((course) => [course.id, course]));

  return Option.some<Reading>({
    plan: {
      lessons: lessons.filter(chosen).map((lesson) => {
        const course = named.get(lesson.courseId);

        return {
          ...lesson,
          course: course?.name ?? "",
          subject: Option.fromNullishOr(subjects.get(course?.subjectId ?? "")),
        };
      }),
      closures,
      coveredUntil: status?.coveredUntil,
    },
    names: {
      teachers: new Map(teachers.map((row) => [row.id, row.displayName ?? row.shortName])),
      rooms: new Map(rooms.map((row) => [row.id, row.name])),
    },
    observedAt: Option.map(Option.fromNullishOr(status), (row) =>
      DateTime.toEpochMillis(row.observedAt),
    ),
    weekLabels: new Map(weekLabels.map((row) => [row.id, row.label])),
  });
});

const tables = [
  Notebook.Row,
  Course.Row,
  Subject.Row,
  Teacher.Row,
  Room.Row,
  Closure.Row,
  ImportStatus.Row,
  Lesson.Row,
  Term.Row,
  Enrollment.Row,
  WeekLabel.Row,
];

/** The timetable from a date on, again whenever a table it reads changes. */
export const query = SyncQuery.read({
  tables,
  run: (from: string) => read(from).pipe(Effect.catchTags({ SchemaError: Effect.die })),
});

/** The account's timetable from a date on, such as `2026-11-16`. `None` without a notebook. */
export const reading = Atom.family((accountId: string) =>
  SyncQuery.family(runtime(accountId), query),
);

/** One lesson the device holds, with the timetable from its day on. */
export interface Held {
  readonly reading: Reading;
  /** With the other half of its double period, as the card shows it (`Timetable.blocks`). */
  readonly lesson: AgendaItem.Source;
}

/** The lesson `id` and the timetable from its day on, `None` once it is gone or not chosen. */
const readLesson = Effect.fn("TimetableState.readLesson")(function* (id: string) {
  const db = yield* DeviceDatabase.make;

  const [row] = yield* Effect.flatMap(
    db.select().from(Device.Lesson).where(eq(Device.Lesson.id, id)),
    decode.lesson,
  );

  if (row === undefined) return Option.none<Held>();

  const held = yield* read(CivilTime.format(row.date));

  return Option.flatMap(held, (reading) =>
    Arr.findFirst(Timetable.blocks(reading.plan.lessons), (lesson) => lesson.id === id).pipe(
      Option.orElse(() => Arr.findFirst(reading.plan.lessons, (lesson) => lesson.id === id)),
      Option.map((lesson) => ({ reading, lesson })),
    ),
  );
});

/** One lesson by its id, again whenever a table it reads changes. */
export const lessonQuery = SyncQuery.read({
  tables,
  run: (id: string) => readLesson(id).pipe(Effect.catchTags({ SchemaError: Effect.die })),
});

/** The account's lesson by its id, as the lesson sheet shows it. */
export const lesson = Atom.family((accountId: string) =>
  SyncQuery.family(runtime(accountId), lessonQuery),
);

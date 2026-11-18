import {
  type CivilTime,
  Closure,
  Course,
  ImportStatus,
  Lesson,
  Notebook,
  Room,
  School,
  Subject,
  Teacher,
  type Timetable,
} from "@stu/core";
import type { AgendaItem } from "@stu/domain-ui/timetable/AgendaItem";
import { DeviceDatabase, DeviceSchema, SyncQuery } from "@stu/sync/client";
import { gte } from "drizzle-orm";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";

import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Schema as Device } from "../../infra/sqlite/Schema.ts";

// The school's timetable as the device holds it, for the Übersicht's card: the lessons from this
// week's Monday on with their courses, and the school's teachers, rooms, closures and Stand.

export * as TimetableState from "./TimetableState.ts";

const runtime = Atom.family((accountId: string) => Atom.runtime(AccountEngine.app(accountId)));

/** What the device holds of the timetable. */
export interface Reading {
  /** The school's, which decides what "today" and "now" are. */
  readonly timeZone: CivilTime.TimeZone;
  readonly plan: Timetable.Plan<AgendaItem.Source>;
  readonly names: AgendaItem.Names;
  /** When the import last read the school, in epoch milliseconds. `None` without a Stand. */
  readonly observedAt: Option.Option<number>;
}

const decode = {
  notebook: DeviceSchema.decodeView(Notebook.Row),
  school: DeviceSchema.decodeView(School.Row),
  course: DeviceSchema.decodeView(Course.Row),
  subject: DeviceSchema.decodeView(Subject.Row),
  teacher: DeviceSchema.decodeView(Teacher.Row),
  room: DeviceSchema.decodeView(Room.Row),
  closure: DeviceSchema.decodeView(Closure.Row),
  status: DeviceSchema.decodeView(ImportStatus.Row),
  lesson: DeviceSchema.decodeView(Lesson.Row),
};

/**
 * Every lesson on the device is the student's: it receives only the Course spaces of its notebook's
 * course choice. So lessons are read by date alone, from `from` on (as `CivilTime.format` writes
 * it), and the school's other rows whole, as a school holds a few hundred of them at most.
 */
const read = Effect.fn("TimetableState.read")(function* (from: string) {
  const db = yield* DeviceDatabase.make;
  const [notebook] = yield* Effect.flatMap(db.select().from(Device.Notebook), decode.notebook);

  if (notebook === undefined) return Option.none<Reading>();

  const inSchool = <A extends { readonly space: string }>(rows: ReadonlyArray<A>) =>
    rows.filter((row) => row.space === notebook.schoolId);

  const [school] = inSchool(yield* Effect.flatMap(db.select().from(Device.School), decode.school));
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

  const named = new Map(courses.map((course) => [course.id, course]));

  return Option.some<Reading>({
    timeZone: school?.timeZone ?? School.defaultTimeZone,
    plan: {
      lessons: lessons.map((lesson) => {
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
  });
});

/** The timetable from a date on, again whenever a table it reads changes. */
export const query = SyncQuery.read({
  tables: [
    Notebook.Row,
    School.Row,
    Course.Row,
    Subject.Row,
    Teacher.Row,
    Room.Row,
    Closure.Row,
    ImportStatus.Row,
    Lesson.Row,
  ],
  run: (from: string) => read(from).pipe(Effect.catchTags({ SchemaError: Effect.die })),
});

/** The account's timetable from a date on, such as `2026-11-16`. `None` without a notebook. */
export const reading = Atom.family((accountId: string) =>
  SyncQuery.family(runtime(accountId), query),
);

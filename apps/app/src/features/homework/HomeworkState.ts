import {
  CivilTime,
  Course,
  Enrollment,
  Homework,
  Notebook,
  NotebookProfile,
  School,
  Subject,
} from "@stu/core";
import type { HomeworkItem } from "@stu/domain-ui/homework/HomeworkItem";
import { DeviceDatabase, DeviceSchema, type Outbox, SyncClient } from "@stu/sync/client";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";

import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Schema as Device } from "../../infra/sqlite/Schema.ts";

// The notebook's homework as atoms for the screens, on the account's engine: the rows with their
// courses, which of them wait for the server, the refused changes, and ticking one done.

export * as HomeworkState from "./HomeworkState.ts";

const runtime = Atom.family((accountId: string) => Atom.runtime(AccountEngine.app(accountId)));

/** What the device holds of the notebook's homework. */
export interface Reading {
  readonly notebook: Notebook.Id;
  /** The school's, which decides what "today" is. */
  readonly timeZone: CivilTime.TimeZone;
  readonly homework: ReadonlyArray<HomeworkItem.Source>;
  /** The notebook's changes the server refused, oldest first, apart from the course choice. */
  readonly refusals: ReadonlyArray<Outbox.Rejected>;
  /** The device's changes the server hasn't settled yet. */
  readonly waiting: number;
}

const decode = {
  notebook: DeviceSchema.decodeView(Notebook.Row),
  school: DeviceSchema.decodeView(School.Row),
  course: DeviceSchema.decodeView(Course.Row),
  subject: DeviceSchema.decodeView(Subject.Row),
  homework: DeviceSchema.decodeView(Homework.Row),
  pending: Schema.decodeUnknownEffect(
    Schema.Array(Schema.Struct({ space: Schema.String, tbl: Schema.String, id: Schema.String })),
  ),
};

/** The time zone of a device that holds no school row yet. */
const fallbackTimeZone = CivilTime.TimeZone.make("Europe/Berlin");

// The first start shows refused course choices itself (OnboardingState).
const shownElsewhere: ReadonlySet<string> = new Set([Enrollment.set.name]);

/** The device holds a handful of rows per table here, so each is read whole and picked in memory. */
const read = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
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

  const pending = yield* Effect.flatMap(
    sql`select space, tbl, id from pending_row where space = ${notebook.id}`,
    decode.pending,
  );

  const waiting = new Set(
    pending.flatMap((row) => (row.tbl === Homework.Row.name ? [row.id] : [])),
  );

  const named = new Map(courses.map((course) => [course.id, course]));

  const homework = (yield* Effect.flatMap(
    db.select().from(Device.Homework),
    decode.homework,
  )).flatMap((row): ReadonlyArray<HomeworkItem.Source> => {
    if (row.space !== notebook.id) return [];

    const course = named.get(row.courseId);

    return [
      {
        id: row.id,
        dueOn: row.dueOn,
        doneOn: row.doneOn,
        title: row.title,
        course: course?.name ?? "",
        subject: Option.fromNullishOr(subjects.get(course?.subjectId ?? "")),
        waiting: waiting.has(row.id),
      },
    ];
  });

  const refusals = (yield* SyncClient.refusals.run()).filter(
    (refusal) => !shownElsewhere.has(refusal.name),
  );

  return Option.some<Reading>({
    notebook: Notebook.Id.make(notebook.id),
    timeZone: school?.timeZone ?? fallbackTimeZone,
    homework,
    refusals,
    waiting: (yield* SyncClient.pending.run()).length,
  });
});

const tables = [
  Notebook.Row,
  NotebookProfile.Row,
  School.Row,
  Course.Row,
  Subject.Row,
  Homework.Row,
];

// The tables it reads, and the engine's own, which change as a pull, a settle or a refusal arrives.
const keys = [...Object.values(SyncClient.keys), ...tables.map((table) => table.name)];

/** The notebook's homework, again after every write, pull and rebase. `None` without a notebook. */
export const reading = Atom.family((accountId: string) =>
  runtime(accountId).atom(
    Reactivity.stream(
      Effect.flatMap(SqlClient.SqlClient, (sql) => sql.withTransaction(read)).pipe(
        Effect.catchTags({ SchemaError: Effect.die }),
      ),
      keys,
    ),
  ),
);

/**
 * Today at the school, read again every minute, so "Bis morgen" turns into "Heute fällig" at
 * midnight on a screen that stays open.
 */
export const today = Atom.family((timeZone: CivilTime.TimeZone) =>
  Atom.make(
    Stream.tick(Duration.minutes(1)).pipe(
      Stream.mapEffect(() =>
        Effect.map(Clock.currentTimeMillis, (now) => CivilTime.dateIn(now, timeZone)),
      ),
      Stream.changesWith((a, b) => CivilTime.order(a, b) === 0),
    ),
  ),
);

/** A homework to tick done on `doneOn`, or to open again without it. */
export interface Toggle {
  readonly notebook: Notebook.Id;
  readonly id: string;
  readonly doneOn: CivilTime.PlainDate | undefined;
}

/**
 * The device itself refused a tick, as when another device deleted the homework a moment before.
 * `reason` is the refusal's tag.
 */
export class NotToggled extends Schema.TaggedError<NotToggled, { readonly brand: unique symbol }>()(
  "HomeworkState.NotToggled",
  { id: Schema.String, done: Schema.Boolean, reason: Schema.String },
) {}

/** Ticks a homework done or opens it again, on this device at once; the engine sends it later. */
export const setDone = Atom.family((accountId: string) =>
  runtime(accountId).fn<Toggle>()((toggle) =>
    Effect.flatMap(SyncClient.Service, (sync) =>
      sync.mutate(Homework.setDone, {
        notebook: toggle.notebook,
        id: Homework.Id.make(toggle.id),
        doneOn: toggle.doneOn,
      }),
    ).pipe(
      Effect.mapError(
        (refused) =>
          new NotToggled({
            id: toggle.id,
            done: toggle.doneOn !== undefined,
            reason: refused._tag,
          }),
      ),
    ),
  ),
);

/** "Nochmal versuchen": runs a refused change again from its stored arguments. */
export const redo = Atom.family((accountId: string) =>
  runtime(accountId).fn<Outbox.Rejected>()((rejected) =>
    Effect.flatMap(SyncClient.Service, (sync) => sync.redo(rejected)),
  ),
);

/** "Verwerfen": lets a refused change go. */
export const dismiss = Atom.family((accountId: string) =>
  runtime(accountId).fn<Outbox.Rejected>()((rejected) =>
    Effect.flatMap(SyncClient.Service, (sync) => sync.dismiss(rejected)),
  ),
);

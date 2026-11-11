import { CivilTime, Course, Homework, Notebook, NotebookProfile, School, Subject } from "@stu/core";
import { DeviceDatabase, DeviceSchema, SyncClient } from "@stu/sync/client";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Ref from "effect/Ref";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";

import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Schema as Device } from "../../infra/sqlite/Schema.ts";
import { Overview } from "./Overview.ts";

// The Übersicht as atoms for its screen, on the account's engine: what the device holds of the
// notebook's homework, the tick that marks one done, and what became of a change the server or the
// device refused.

export * as OverviewState from "./OverviewState.ts";

const runtime = Atom.family((accountId: string) => Atom.runtime(AccountEngine.app(accountId)));

const decode = {
  notebook: DeviceSchema.decodeView(Notebook.Row),
  profile: DeviceSchema.decodeView(NotebookProfile.Row),
  school: DeviceSchema.decodeView(School.Row),
  course: DeviceSchema.decodeView(Course.Row),
  subject: DeviceSchema.decodeView(Subject.Row),
  homework: DeviceSchema.decodeView(Homework.Row),
};

/** The time zone of a device without school data yet. */
const fallbackTimeZone = CivilTime.TimeZone.make("Europe/Berlin");

/** A student has tens of courses and homework, so each table is read whole and joined in memory. */
const read = Effect.gen(function* () {
  const db = yield* DeviceDatabase.make;
  const [notebook] = yield* Effect.flatMap(db.select().from(Device.Notebook), decode.notebook);

  const inSchool = <A extends { readonly space: string }>(rows: ReadonlyArray<A>) =>
    rows.filter((row) => row.space === notebook?.schoolId);

  const [school] = inSchool(yield* Effect.flatMap(db.select().from(Device.School), decode.school));
  const timeZone = school?.timeZone ?? fallbackTimeZone;

  const courses = new Map(
    inSchool(yield* Effect.flatMap(db.select().from(Device.Course), decode.course)).map(
      (row) => [row.id, row] as const,
    ),
  );

  const subjects = new Map(
    inSchool(yield* Effect.flatMap(db.select().from(Device.Subject), decode.subject)).map(
      (row) => [row.id, row] as const,
    ),
  );

  const inNotebook = <A extends { readonly space: string }>(rows: ReadonlyArray<A>) =>
    rows.filter((row) => row.space === notebook?.id);

  const [profile] = inNotebook(
    yield* Effect.flatMap(db.select().from(Device.NotebookProfile), decode.profile),
  );

  const homework = inNotebook(
    yield* Effect.flatMap(db.select().from(Device.Homework), decode.homework),
  ).map((row) => {
    const course = Option.fromNullishOr(courses.get(row.courseId));

    return {
      id: row.id,
      title: row.title,
      dueOn: row.dueOn,
      doneOn: row.doneOn,
      course,
      subject: Option.flatMap(course, ({ subjectId }) =>
        Option.fromNullishOr(subjectId === undefined ? undefined : subjects.get(subjectId)),
      ),
    };
  });

  return {
    notebook: Option.map(Option.fromNullishOr(notebook), ({ id }) => Notebook.Id.make(id)),
    name: Option.fromNullishOr(profile?.displayName),
    today: CivilTime.dateIn(yield* Clock.currentTimeMillis, timeZone),
    timeZone,
    homework,
    refused: (yield* SyncClient.refusals.run()).filter(Overview.shows),
  } satisfies Overview.Reading;
});

const tables = [
  Notebook.Row,
  NotebookProfile.Row,
  School.Row,
  Course.Row,
  Subject.Row,
  Homework.Row,
];

// The tables it reads, and the engine's own, which change as a refusal arrives or goes.
const keys = [...Object.values(SyncClient.keys), ...tables.map((table) => table.name)];

/**
 * What the Übersicht shows, again after every write, pull and rebase, and when the day changes at
 * the school, which no table records: a phone left open overnight must not say "Bis morgen" for
 * homework that is due today.
 */
export const reading = Atom.family((accountId: string) =>
  runtime(accountId).atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const shown = yield* Ref.make(Option.none<Overview.Reading>());

        const fresh = Effect.flatMap(SqlClient.SqlClient, (sql) => sql.withTransaction(read)).pipe(
          Effect.catchTags({ SchemaError: Effect.die }),
          Effect.tap((now) => Ref.set(shown, Option.some(now))),
        );

        const newDay = Effect.gen(function* () {
          const now = yield* Clock.currentTimeMillis;

          return Option.exists(
            yield* Ref.get(shown),
            ({ today, timeZone }) => CivilTime.order(today, CivilTime.dateIn(now, timeZone)) !== 0,
          );
        });

        return Stream.merge(
          Reactivity.stream(fresh, keys),
          Stream.tick("1 minute").pipe(
            Stream.filterEffect(() => newDay),
            Stream.mapEffect(() => fresh),
          ),
        );
      }),
    ),
  ),
);

/**
 * Whether the device is offline, and how many changes wait. The engine reports "offline" between
 * its attempts to connect too, so the flag follows only after it held for a moment.
 */
export const connection = Atom.family((accountId: string) =>
  runtime(accountId).atom(
    Stream.unwrap(
      Effect.map(SyncClient.Service, (sync) =>
        Stream.zipLatest(
          sync.status.changes.pipe(
            Stream.map((status) => status.connection !== "online"),
            Stream.changes,
            Stream.debounce("2 seconds"),
          ),
          sync.status.changes.pipe(
            Stream.map((status) => status.waiting),
            Stream.changes,
          ),
        ),
      ),
    ).pipe(Stream.map(([offline, waiting]): Overview.Connection => ({ offline, waiting }))),
  ),
);

/** The last change this device refused itself, until the student has read why. */
export const failed = Atom.family((_accountId: string) =>
  Atom.make(Option.none<Overview.Failed>()),
);

export interface Tick {
  readonly notebook: Notebook.Id;
  readonly id: string;
  /** The day the homework was done, today at the school. Absent to open it again. */
  readonly doneOn: CivilTime.PlainDate | undefined;
  /** What the tick asks for, which the card repeats if the device refuses it. */
  readonly change: string;
}

/**
 * Ticks a homework done or opens it again, on this device first; the engine sends it when it can.
 * A tick the device refuses, as for homework another device deleted, leaves its reason in `failed`.
 */
export const tick = Atom.family((accountId: string) =>
  runtime(accountId).fn<Tick>()(
    ({ notebook, id, doneOn, change }, get) =>
      Effect.flatMap(SyncClient.Service, (sync) =>
        sync.mutate(Homework.setDone, { notebook, id: Homework.Id.make(id), doneOn }),
      ).pipe(
        Effect.matchEffect({
          onSuccess: () => Effect.sync(() => get.set(failed(accountId), Option.none())),
          onFailure: (reason) =>
            Effect.sync(() => get.set(failed(accountId), Option.some({ change, reason }))),
        }),
      ),
    { concurrent: true },
  ),
);

export interface Redo {
  readonly refused: Overview.Refused;
  readonly change: string;
}

/** "Nochmal versuchen": runs a refused command again. If the device refuses it now, it stays. */
export const redo = Atom.family((accountId: string) =>
  runtime(accountId).fn<Redo>()(({ refused, change }, get) =>
    Effect.flatMap(SyncClient.Service, (sync) => sync.redo(refused)).pipe(
      Effect.matchEffect({
        onSuccess: () => Effect.void,
        onFailure: (reason) =>
          Effect.sync(() => get.set(failed(accountId), Option.some({ change, reason }))),
      }),
    ),
  ),
);

/** "Verwerfen": lets a refused command go. */
export const dismiss = Atom.family((accountId: string) =>
  runtime(accountId).fn<Overview.Refused>()((refused) =>
    Effect.flatMap(SyncClient.Service, (sync) => sync.dismiss(refused)),
  ),
);

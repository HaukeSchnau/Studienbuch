import {
  CivilTime,
  Course,
  Enrollment,
  Homework,
  Notebook,
  School,
  Subject,
  Term,
} from "@stu/core";
import type { CourseChoice } from "@stu/domain-ui/homework/HomeworkForm";
import { HomeworkItem } from "@stu/domain-ui/homework/HomeworkItem";
import type { Tx } from "@stu/sync";
import { DeviceDatabase, DeviceSchema, type Outbox, SyncClient, SyncQuery } from "@stu/sync/client";
import * as Clock from "effect/Clock";
import * as Data from "effect/Data";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import * as Atom from "effect/reactivity/Atom";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import * as Struct from "effect/Struct";

import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Schema as Device } from "../../infra/sqlite/Schema.ts";
import { Account } from "../account/Account.ts";
import { AccountState } from "../account/AccountState.ts";
import { KeysState } from "../keys/KeysState.ts";
import { NotebookKeys } from "../keys/NotebookKeys.ts";
import { HomeworkInput } from "./HomeworkInput.ts";
import { Offline } from "./Offline.ts";

// The notebook's homework as atoms for the screens, on the account's engine: the rows with their
// courses, which of them wait for the server, the refused changes, the courses to choose from,
// the sheet's drafts, and the writes.

export * as HomeworkState from "./HomeworkState.ts";

// The drafts live in the account's own database, as the first start's do (OnboardingState).
const runtime = Atom.family((accountId: string) =>
  Atom.runtime(KeyValueStore.layerSql().pipe(Layer.provideMerge(AccountEngine.app(accountId)))),
);

/** One homework as the device holds it: what the panel shows, and what its page and sheet add. */
export interface Stored extends HomeworkItem.Source {
  readonly courseId: string;
  readonly description: string | undefined;
}

/** What the device holds of the notebook's homework. */
export interface Reading {
  readonly notebook: Notebook.Id;
  /** The school's, which decides what "today" is. */
  readonly timeZone: CivilTime.TimeZone;
  readonly homework: ReadonlyArray<Stored>;
  /** The notebook's changes the server refused, oldest first, apart from the course choice. */
  readonly refusals: ReadonlyArray<Outbox.Rejected>;
  /** The school's terms and the notebook's course choices, which `choices` picks Fach from. */
  readonly terms: ReadonlyArray<Tx.Entry<Term.Row>>;
  readonly enrollments: ReadonlyArray<HomeworkInput.Chosen>;
  /** The school's courses by id, named and marked as homework shows them. */
  readonly courses: ReadonlyMap<string, CourseChoice>;
}

const decode = {
  notebook: DeviceSchema.decodeView(Notebook.Row),
  school: DeviceSchema.decodeView(School.Row),
  course: DeviceSchema.decodeView(Course.Row),
  subject: DeviceSchema.decodeView(Subject.Row),
  homework: DeviceSchema.decodeView(Homework.Row),
  term: DeviceSchema.decodeView(Term.Row),
  enrollment: DeviceSchema.decodeView(Enrollment.Row),
  pending: Schema.decodeUnknownEffect(
    Schema.Array(Schema.Struct({ space: Schema.String, tbl: Schema.String, id: Schema.String })),
  ),
};

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
  )).flatMap((row): ReadonlyArray<Stored> => {
    if (row.space !== notebook.id) return [];

    const course = named.get(row.courseId);

    return [
      {
        id: row.id,
        courseId: row.courseId,
        dueOn: row.dueOn,
        doneOn: row.doneOn,
        title: row.title,
        description: row.description,
        course: course?.name ?? "",
        subject: Option.fromNullishOr(subjects.get(course?.subjectId ?? "")),
        waiting: waiting.has(row.id),
      },
    ];
  });

  const terms = inSchool(yield* Effect.flatMap(db.select().from(Device.Term), decode.term)).map(
    (row) => ({ id: row.id, row: Struct.omit(row, ["space", "id"]) }),
  );

  const enrollments = (yield* Effect.flatMap(
    db.select().from(Device.Enrollment),
    decode.enrollment,
  )).filter((row) => row.space === notebook.id);

  const refusals = (yield* SyncClient.refusals.run()).filter(
    (refusal) => !shownElsewhere.has(refusal.name),
  );

  return Option.some<Reading>({
    notebook: Notebook.Id.make(notebook.id),
    timeZone: school?.timeZone ?? School.defaultTimeZone,
    homework,
    refusals,
    terms,
    enrollments,
    courses: new Map(
      courses.map((course) => [
        course.id,
        {
          id: course.id,
          ...HomeworkItem.named(
            course.name,
            Option.fromNullishOr(subjects.get(course.subjectId ?? "")),
          ),
        },
      ]),
    ),
  });
});

/**
 * The notebook's homework, which `reading` keeps current. The engine invalidates a table whenever
 * its rows in `pending_row` change, so `Homework` covers which of them wait.
 */
export const query = SyncQuery.read({
  tables: [
    Notebook.Row,
    School.Row,
    Course.Row,
    Subject.Row,
    Homework.Row,
    Term.Row,
    Enrollment.Row,
  ],
  queries: [SyncClient.refusals],
  run: () => read.pipe(Effect.catchTags({ SchemaError: Effect.die })),
});

/** The notebook's homework, again whenever a table it reads changes. `None` without a notebook. */
export const reading = Atom.family((accountId: string) =>
  SyncQuery.family(runtime(accountId), query)(),
);

/**
 * Today at the school, read again every minute, so "Bis morgen" turns into "Heute fällig" at
 * midnight on a screen that stays open.
 */
export const today = Atom.family((timeZone: CivilTime.TimeZone) =>
  Atom.make(
    Stream.tick(Duration.minutes(1)).pipe(
      Stream.mapEffect(() =>
        Effect.map(Clock.currentTimeMillis, (now) => School.today({ timeZone }, now)),
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

/**
 * Ticks a homework done or opens it again, on this device at once; the engine sends it later. Ticks
 * run side by side, so a second card ticked at once doesn't cut the first one's transaction short.
 */
export const setDone = Atom.family((accountId: string) =>
  runtime(accountId).fn<Toggle>()(
    (toggle) =>
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
    { concurrent: true },
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

/**
 * The courses the sheet offers as Fach on `today` (`HomeworkInput.offered`), by subject name, and
 * `kept`, the course of the homework being edited, even when it is no longer chosen.
 */
export const choices = (
  reading: Reading,
  today: CivilTime.PlainDate,
  kept?: string,
): ReadonlyArray<CourseChoice> => {
  const offered = HomeworkInput.offered(reading.enrollments, reading.terms, today);
  const ids = kept === undefined || offered.includes(kept) ? offered : [...offered, kept];

  return ids
    .flatMap((id) => Option.toArray(Option.fromNullishOr(reading.courses.get(id))))
    .sort((a, b) => a.subject.localeCompare(b.subject, "de"));
};

// Earlier builds kept whole values under `homework-draft-…`; this shape gets a key of its own.
const draftKey = (key: string) => `homework-touched-${key}`;

/**
 * What the student touched in the sheet for a new homework (`"new"`) or one homework's edit (its id),
 * kept across a restart until it is saved or dropped (`HomeworkInput.Draft`).
 */
export const draft = Atom.family((accountId: string) =>
  Atom.family((key: string) =>
    Atom.kvs({
      runtime: runtime(accountId),
      key: draftKey(key),
      schema: HomeworkInput.Draft,
      defaultValue: () => ({}),
      mode: "async",
    }),
  ),
);

/** A save from the sheet: a new homework, or the fields an edit changed. */
export type Save = Data.TaggedEnum<{
  Create: {
    readonly notebook: Notebook.Id;
    /** A random UUIDv4, which `Homework.Id` explains. */
    readonly id: string;
    readonly valid: HomeworkInput.Valid;
  };
  Update: {
    readonly notebook: Notebook.Id;
    readonly id: string;
    readonly valid: HomeworkInput.Valid;
    readonly current: HomeworkInput.Current;
    readonly touched: HomeworkInput.Draft;
  };
}>;

export const Save = Data.taggedEnum<Save>();

/**
 * This device refused a save itself, as when the course left the course choice on another device a
 * moment before. `reason` is the refusal's tag.
 */
export class Unsaved extends Schema.TaggedError<Unsaved, { readonly brand: unique symbol }>()(
  "HomeworkState.Unsaved",
  { reason: Schema.String },
) {}

/** Saves the sheet on this device at once and drops its draft; the engine sends it later. */
export const save = Atom.family((accountId: string) =>
  runtime(accountId).fn<{ readonly save: Save; readonly draft: string }>()(
    ({ save, draft: key }, get) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;

        if (save._tag === "Create") {
          yield* sync.mutate(Homework.create, {
            notebook: save.notebook,
            id: Homework.Id.make(save.id),
            ...save.valid,
          });
        } else {
          yield* sync.mutate(Homework.update, {
            notebook: save.notebook,
            id: Homework.Id.make(save.id),
            ...HomeworkInput.changes(save.valid, save.current, save.touched),
          });
        }
      }).pipe(
        Effect.mapError((refused) => new Unsaved({ reason: refused._tag })),
        Effect.andThen(dropDraft(accountId, key, get)),
      ),
  ),
);

/** "Abbrechen": drops the sheet's draft. */
export const discard = Atom.family((accountId: string) =>
  runtime(accountId).fn<string>()((key, get) => dropDraft(accountId, key, get)),
);

// From the store itself, not through the draft atom, which writes through an atom of its own that
// the sheet closing right after would interrupt. The homework is saved by then, so a store that
// fails here leaves a stale draft rather than a save that looks refused.
const dropDraft = (accountId: string, key: string, get: Atom.FnContext) =>
  Effect.flatMap(KeyValueStore.KeyValueStore, (store) => store.remove(draftKey(key))).pipe(
    Effect.ignore,
    Effect.andThen(Effect.sync(() => get.set(draft(accountId)(key), {}))),
  );

/** The device itself refused a delete. `reason` is the refusal's tag. */
export class NotDeleted extends Schema.TaggedError<NotDeleted, { readonly brand: unique symbol }>()(
  "HomeworkState.NotDeleted",
  { id: Schema.String, reason: Schema.String },
) {}

/** Deletes a homework on this device at once; the engine sends it later. */
export const remove = Atom.family((accountId: string) =>
  runtime(accountId).fn<{ readonly notebook: Notebook.Id; readonly id: string }>()(
    ({ notebook, id }) =>
      Effect.flatMap(SyncClient.Service, (sync) =>
        sync.mutate(Homework.delete, { notebook, id: Homework.Id.make(id) }),
      ).pipe(
        Effect.asVoid,
        Effect.mapError((refused) => new NotDeleted({ id, reason: refused._tag })),
      ),
  ),
);

/** What every homework screen and the Übersicht show around their content. */
export interface Status {
  readonly today: CivilTime.PlainDate;
  /**
   * The device doesn't hold the notebook's key: it is `Locked`, `Offline` or `NotHere`, or its status
   * failed (`NotebookKeys.unlocked`).
   */
  readonly locked: boolean;
  /**
   * The device holds the notebook's key. Until then the homework rows stay sealed, and an empty
   * list would say there is no homework, so the screens show none.
   */
  readonly readable: boolean;
  /**
   * `Some` with the changes that wait for the server while the device has no connection. Not while
   * the session has ended, which the account's notice says instead.
   */
  readonly offline: Option.Option<{ readonly waiting: number }>;
  /** `None` until the device has read the notebook, or when the account has none. */
  readonly reading: Option.Option<Reading>;
}

/** Whether the engine is offline (`Offline.shown`), and how many changes wait for the server. */
const connection = Atom.family((accountId: string) =>
  runtime(accountId).atom(
    Stream.unwrap(
      Effect.map(SyncClient.Service, (sync) =>
        Stream.zipLatest(
          Offline.shown(
            sync.status.changes.pipe(Stream.map((status) => status.connection !== "online")),
          ),
          sync.status.changes.pipe(
            Stream.map((status) => status.waiting),
            Stream.changes,
          ),
        ),
      ),
    ),
  ),
);

/**
 * Today at the school, the key and the connection, with what the device holds of the notebook.
 * `None` until today is known. A homework's waiting marker shows only offline: online, a change
 * settles within a second, so the marker would only flicker.
 */
export const status = Atom.family((accountId: string) =>
  Atom.make((get): Option.Option<Status> => {
    const held = Option.flatten(AsyncResult.value(get(reading(accountId))));

    const now = AsyncResult.value(
      get(
        today(
          Option.match(held, {
            onNone: () => School.defaultTimeZone,
            onSome: (r) => r.timeZone,
          }),
        ),
      ),
    );

    if (Option.isNone(now)) return Option.none();

    const disconnected = Option.filter(
      AsyncResult.value(get(connection(accountId))),
      ([offline]) => offline,
    );

    const ended = Account.access(get(AccountState.current)) === "ended";

    const unlocked = NotebookKeys.unlocked(get(KeysState.status(accountId)));

    return Option.some({
      today: now.value,
      locked: Option.contains(unlocked, false),
      readable: Option.contains(unlocked, true),
      offline: ended ? Option.none() : Option.map(disconnected, ([, waiting]) => ({ waiting })),
      reading: Option.map(held, (value) => ({
        ...value,
        homework: value.homework.map((each) => ({
          ...each,
          waiting: each.waiting && Option.isSome(disconnected),
        })),
      })),
    });
  }),
);

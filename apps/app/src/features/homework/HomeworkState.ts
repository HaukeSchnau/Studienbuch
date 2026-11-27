import { type CivilTime, Course, Enrollment, Homework, Notebook, Subject, Term } from "@stu/core";
import type { CourseChoice } from "@stu/domain-ui/homework/HomeworkForm";
import type { HomeworkItem } from "@stu/domain-ui/homework/HomeworkItem";
import { SubjectMark } from "@stu/domain-ui/subject/SubjectMark";
import type { Tx } from "@stu/sync";
import { DeviceDatabase, DeviceSchema, type Outbox, SyncClient, SyncQuery } from "@stu/sync/client";
import { and, eq, getTableName, sql } from "drizzle-orm";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import * as Atom from "effect/reactivity/Atom";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Struct from "effect/Struct";

import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Schema as Device } from "../../infra/sqlite/Schema.ts";
import { DeviceStatus } from "../device-status/DeviceStatus.ts";
import { HomeworkInput } from "./HomeworkInput.ts";

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
    homework,
    refusals,
    terms,
    enrollments,
    courses: new Map(
      courses.map((course) => [
        course.id,
        {
          id: course.id,
          ...SubjectMark.named(
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
  tables: [Notebook.Row, Course.Row, Subject.Row, Homework.Row, Term.Row, Enrollment.Row],
  queries: [SyncClient.refusals],
  run: () => read.pipe(Effect.catchTags({ SchemaError: Effect.die })),
});

/** The notebook's homework, again whenever a table it reads changes. `None` without a notebook. */
export const reading = Atom.family((accountId: string) =>
  SyncQuery.family(runtime(accountId), query)(),
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
        holdRefusal("HomeworkState.NotToggled", toggle.id),
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
 * The courses the sheet offers as Fach on `today` (`Enrollment.chosenOn`), by subject name, and
 * `kept`, the course of the homework being edited, even when it is no longer chosen.
 */
export const choices = (
  reading: Reading,
  today: CivilTime.PlainDate,
  kept?: string,
): ReadonlyArray<CourseChoice> => {
  const offered = Enrollment.chosenOn(reading.enrollments, reading.terms, today);
  const ids = kept === undefined || offered.includes(kept) ? offered : [...offered, kept];

  return ids
    .flatMap((id) => Option.toArray(Option.fromNullishOr(reading.courses.get(id))))
    .sort((a, b) => a.subject.localeCompare(b.subject, "de"));
};

// Earlier builds kept whole values under `homework-draft-…`; this shape gets a key of its own.
const draftKey = (key: string) => `homework-touched-${key}`;

/**
 * What the student touched in the sheet under its `HomeworkInput.draftKey`, kept across a restart
 * until it is saved or dropped (`HomeworkInput.Draft`).
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
    /** The draft as it was at the press. */
    readonly touched: HomeworkInput.Draft;
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

/**
 * What the sheet does after a save: close (`Done`), stay open with what the student typed after
 * the press (`Kept`), or open the new homework's edit with it (`Moved`), since saving the add sheet
 * again would add the homework twice.
 */
export type Saved = Data.TaggedEnum<{ Done: {}; Kept: {}; Moved: { readonly id: string } }>;

export const Saved = Data.taggedEnum<Saved>();

/**
 * Saves the sheet on this device at once; the engine sends it later. The draft goes only if it still
 * holds what was submitted (`HomeworkInput.unchangedSince`), as the fields stay editable meanwhile.
 */
export const save = Atom.family((accountId: string) =>
  runtime(accountId).fn<{ readonly save: Save; readonly draft: string }>()(
    ({ save, draft: key }, get) =>
      Effect.gen(function* () {
        const sync = yield* SyncClient.Service;

        yield* Effect.mapError(
          save._tag === "Create"
            ? sync.mutate(Homework.create, {
                notebook: save.notebook,
                id: Homework.Id.make(save.id),
                ...save.valid,
              })
            : sync.mutate(Homework.update, {
                notebook: save.notebook,
                id: Homework.Id.make(save.id),
                ...HomeworkInput.changes(save.valid, save.current, save.touched),
              }),
          (refused) => new Unsaved({ reason: refused._tag }),
        );

        const registry = yield* AtomRegistry.AtomRegistry;
        const now = AsyncResult.value(registry.get(draft(accountId)(key)));

        if (Option.isSome(now) && !HomeworkInput.unchangedSince(save.touched, now.value)) {
          if (save._tag === "Update") return Saved.Kept();

          yield* moveDraft(accountId, key, save.id, now.value, get);

          return Saved.Moved({ id: save.id });
        }

        yield* dropDraft(accountId, key, get);

        return Saved.Done();
      }),
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

// Through the store as well, for the same reason.
const moveDraft = (
  accountId: string,
  from: string,
  to: string,
  value: HomeworkInput.Draft,
  get: Atom.FnContext,
) =>
  moveStored(from, to, value).pipe(
    Effect.andThen(Effect.sync(() => get.set(draft(accountId)(from), {}))),
    Effect.ignore,
  );

/**
 * Moves a draft to another key, as from the add sheet to the new homework's edit. `from` goes only
 * once `to` holds the draft, so a failed write keeps it where it was.
 */
export const moveStored = (from: string, to: string, value: HomeworkInput.Draft) =>
  Effect.flatMap(KeyValueStore.KeyValueStore, (store) =>
    KeyValueStore.toSchemaStore(store, HomeworkInput.Draft)
      .set(draftKey(to), value)
      .pipe(Effect.andThen(store.remove(draftKey(from)))),
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
        holdRefusal("HomeworkState.NotDeleted", id),
      ),
  ),
);

/** A tick or a delete this device refused itself. */
export type LocalRefusal = NotToggled | NotDeleted;

const heldTable = Device.homework_local_refusal;

const heldKey = getTableName(heldTable);

const RefusalJson = Schema.fromJsonString(
  Schema.toCodecJson(Schema.Union([NotToggled, NotDeleted])),
);

const encodeRefusal = Schema.encodeEffect(RefusalJson);

const decodeHeld = Schema.decodeUnknownEffect(
  Schema.Array(Schema.Struct({ refusal: RefusalJson })),
);

// Only the writes below fill the table, so a row that doesn't decode is a defect.
const readHeld = Effect.flatMap(DeviceDatabase.make, (db) =>
  db
    .select({ refusal: heldTable.refusal })
    .from(heldTable)
    .orderBy(sql`rowid`),
).pipe(
  Effect.flatMap(decodeHeld),
  Effect.map((rows): ReadonlyArray<LocalRefusal> => rows.map((row) => row.refusal)),
  Effect.catchTags({ SchemaError: Effect.die }),
);

// A live read like the engine's: the writes below invalidate the table's name, as the engine does
// for its own tables.
const held: SyncQuery.SyncQuery<
  void,
  ReadonlyArray<LocalRefusal>,
  Effect.Error<typeof readHeld>
> = {
  keys: [heldKey],
  run: () => readHeld,
};

/**
 * The ticks and deletes this device refused itself, oldest first, one per homework and kind, until
 * the student retries or dismisses them. Kept in the account's database across a restart. A fn
 * atom keeps only its latest result, so a second tick would otherwise hide the first one's refusal.
 */
export const localRefusals = Atom.family((accountId: string) =>
  SyncQuery.family(runtime(accountId), held)(),
);

/**
 * Writes one refusal's row and has `localRefusals` read again. Each row is written on its own, so
 * refusals that arrive together don't overwrite each other, and in the engine's scope, so a screen
 * that unmounts can't cut the write short.
 */
const writeHeld = <E>(write: Effect.Effect<unknown, E, SqlClient.SqlClient>) =>
  AccountEngine.inEngineScope(Reactivity.mutation(Effect.asVoid(write), [heldKey]));

const holdOne = (refused: LocalRefusal) =>
  writeHeld(
    Effect.gen(function* () {
      const db = yield* DeviceDatabase.make;
      const refusal = yield* Effect.orDie(encodeRefusal(refused));

      yield* db
        .insert(heldTable)
        .values({ kind: refused._tag, homework: refused.id, refusal })
        .onConflictDoUpdate({ target: [heldTable.kind, heldTable.homework], set: { refusal } });
    }),
  );

const dropOne = (kind: LocalRefusal["_tag"], id: string) =>
  writeHeld(
    Effect.flatMap(DeviceDatabase.make, (db) =>
      db.delete(heldTable).where(and(eq(heldTable.kind, kind), eq(heldTable.homework, id))),
    ),
  );

/** "Verwerfen" on a tick or a delete this device refused itself. Cards go side by side. */
export const dismissLocal = Atom.family((accountId: string) =>
  runtime(accountId).fn<LocalRefusal>()((refused) => dropOne(refused._tag, refused.id), {
    concurrent: true,
  }),
);

/** Holds the change's refusal, or lets an earlier one for the same homework go once it worked. */
const holdRefusal =
  (kind: LocalRefusal["_tag"], id: string) =>
  <A, E extends LocalRefusal, R>(change: Effect.Effect<A, E, R>) =>
    change.pipe(
      Effect.tapError(holdOne),
      Effect.tap(() => dropOne(kind, id)),
    );

/** What every homework screen and the Übersicht show: the device's status, today and the notebook. */
export interface Screen extends DeviceStatus.Status {
  readonly today: CivilTime.PlainDate;
  /** `None` until the device has read the notebook, or when the account has none. */
  readonly reading: Option.Option<Reading>;
}

/**
 * What the screens show of `held`. Without the notebook's key, none of its homework and refused
 * changes: the device may still hold them decrypted from before it locked, and they come back once
 * it holds the key again. A homework's waiting marker shows only offline: online, a change settles
 * within a second, so the marker would only flicker.
 */
export const shown = (
  held: Reading,
  device: Pick<DeviceStatus.Status, "readable" | "disconnected">,
): Reading =>
  device.readable
    ? {
        ...held,
        homework: held.homework.map((each) => ({
          ...each,
          waiting: each.waiting && device.disconnected,
        })),
      }
    : { ...held, homework: [], refusals: [] };

/**
 * The device's status, today at the school (`DeviceStatus.today`) and what the screens show of the
 * notebook (`shown`). `None` until today is known.
 */
export const screen = Atom.family((accountId: string) =>
  Atom.make((get): Option.Option<Screen> => {
    const today = get(DeviceStatus.today(accountId));

    if (Option.isNone(today)) return Option.none();

    const held = Option.flatten(AsyncResult.value(get(reading(accountId))));
    const device = get(DeviceStatus.status(accountId));

    return Option.some({
      ...device,
      today: today.value,
      reading: Option.map(held, (value) => shown(value, device)),
    });
  }),
);

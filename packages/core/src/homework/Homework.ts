/**
 * Hausaufgaben. Homework is encrypted, so its mutators run on the device only: the device's result
 * is final, and the server checks the sealed rows without reading them (ADR 0023). Updates patch
 * the fields they change, so two devices editing different fields both keep their edit (ADR 0020).
 *
 * ```ts
 * mutate(Homework.create, {
 *   notebook,
 *   id: Homework.Id.make(crypto.randomUUID()),
 *   courseId,
 *   title,
 *   dueOn,
 * })
 * ```
 */
import { Sync, Tx } from "@stu/sync";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { CivilTime } from "../civil-time/CivilTime.ts";
import { Enrollment } from "../notebook/Enrollment.ts";
import { Notebook } from "../notebook/Notebook.ts";
import { Course } from "../school/Course.ts";
import { Text } from "../text/Text.ts";
import { HomeworkDates } from "./HomeworkDates.ts";

export * as Homework from "./Homework.ts";

/**
 * A random UUID (version 4) from the caller, such as `crypto.randomUUID()`. The server sees the
 * ids of encrypted rows, and a UUIDv7 would tell it when the homework was created.
 */
export const Id = Schema.String.check(Schema.isUUID(4)).pipe(Schema.brand("HomeworkId"));

export type Id = typeof Id.Type;

// Lengths count UTF-16 code units, as JavaScript and React Native's `maxLength` do.

export const Title = Text.NonBlank.check(Schema.isMaxLength(200));

export type Title = typeof Title.Type;

export const Description = Text.NonBlank.check(Schema.isMaxLength(4000));

export type Description = typeof Description.Type;

/** In the notebook space. M4 adds `photos` as an optional field. */
export const Row = Sync.table("Homework", {
  class: "encrypted",
  fields: {
    courseId: Course.Id,
    title: Title,
    description: Schema.optional(Description),
    dueOn: CivilTime.PlainDate,
    /** The day it was marked done. Absent while it is open. */
    doneOn: Schema.optional(CivilTime.PlainDate),
  },
  indexes: ["dueOn", "courseId"],
  writableBy: { notebook: ["owner"] },
});

export type Row = Sync.Row<typeof Row>;

/** The course isn't in any of the notebook's enrollments. */
export class CourseNotChosen extends Schema.TaggedError<
  CourseNotChosen,
  { readonly brand: unique symbol }
>()("Homework.CourseNotChosen", { courseId: Course.Id }) {}

/** The homework doesn't exist, as when another device deleted it first. */
export class NotFound extends Schema.TaggedError<NotFound, { readonly brand: unique symbol }>()(
  "Homework.NotFound",
  { id: Id },
) {}

export const Refusal = Schema.Union([CourseNotChosen, NotFound]);

export type Refusal = typeof Refusal.Type;

const requireChosen = (notebook: Notebook.Id, courseId: Course.Id) =>
  Effect.flatMap(Enrollment.isChosen(notebook, courseId), (chosen) =>
    chosen ? Effect.void : Effect.fail(new CourseNotChosen({ courseId })),
  );

const requireExisting = (notebook: Notebook.Id, id: Id) =>
  Effect.flatMap(Tx.Service, (tx) => tx.get(Row, notebook, id)).pipe(
    Effect.flatMap(
      Option.match({ onNone: () => Effect.fail(new NotFound({ id })), onSome: Effect.succeed }),
    ),
  );

export const create = Sync.mutator("homework.create", {
  version: 1,
  args: Schema.Struct({
    notebook: Notebook.Id,
    id: Id,
    courseId: Course.Id,
    title: Title,
    description: Schema.optional(Description),
    dueOn: CivilTime.PlainDate,
  }),
  error: CourseNotChosen,
  writes: [Row],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Homework.create")(function* ({ notebook, id, ...row }) {
    yield* requireChosen(notebook, row.courseId);
    const tx = yield* Tx.Service;

    yield* tx.insert(Row, notebook, id, row);
  }),
});

/**
 * Changes the fields it is given and keeps the others. Only a different course is checked, so
 * homework of a course the student dropped can still be edited.
 */
export const update = Sync.mutator("homework.update", {
  version: 1,
  args: Schema.Struct({
    notebook: Notebook.Id,
    id: Id,
    courseId: Schema.optional(Course.Id),
    title: Schema.optional(Title),
    /**
     * `null` removes the description. Not `Schema.optional`, whose JSON codec would send an
     * `undefined` as `null` too.
     */
    description: Schema.optionalKey(Schema.NullOr(Description)),
    dueOn: Schema.optional(CivilTime.PlainDate),
  }),
  error: Refusal,
  writes: [Row],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Homework.update")(function* (args) {
    const current = yield* requireExisting(args.notebook, args.id);

    if (args.courseId !== undefined && args.courseId !== current.courseId) {
      yield* requireChosen(args.notebook, args.courseId);
    }

    // `Tx.patch` removes a field given as `undefined`, so only given fields get a key.
    const changes: { -readonly [Field in keyof Row]?: Row[Field] } = {};

    if (args.courseId !== undefined) changes.courseId = args.courseId;

    if (args.title !== undefined) changes.title = args.title;

    if (args.description !== undefined) changes.description = args.description ?? undefined;

    if (args.dueOn !== undefined) changes.dueOn = args.dueOn;

    const tx = yield* Tx.Service;

    yield* tx.patch(Row, args.notebook, args.id, changes);
  }),
});

/** Marks the homework done on `doneOn`, or open again when `doneOn` is absent. */
export const setDone = Sync.mutator("homework.setDone", {
  version: 1,
  args: Schema.Struct({
    notebook: Notebook.Id,
    id: Id,
    doneOn: Schema.optional(CivilTime.PlainDate),
  }),
  error: NotFound,
  writes: [Row],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Homework.setDone")(function* ({ notebook, id, doneOn }) {
    yield* requireExisting(notebook, id);
    const tx = yield* Tx.Service;

    yield* tx.patch(Row, notebook, id, { doneOn });
  }),
});

/** Deleting homework that is already gone succeeds, so a replay is harmless. */
const remove = Sync.mutator("homework.delete", {
  version: 1,
  args: Schema.Struct({ notebook: Notebook.Id, id: Id }),
  writes: [Row],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Homework.delete")(function* ({ notebook, id }) {
    const tx = yield* Tx.Service;

    yield* tx.remove(Row, notebook, id);
  }),
});

export { remove as delete };

// The display rules live in HomeworkDates, which the landing page loads without Sync and Schema.

export type Listed = HomeworkDates.Listed;

export const order = HomeworkDates.order;

export const isOverdue = HomeworkDates.isOverdue;

export const isDimmed = HomeworkDates.isDimmed;

export const dueDates = HomeworkDates.dueDates;

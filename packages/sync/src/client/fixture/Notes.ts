/**
 * A small domain for the engine's tests, shaped like M1's: a sealed notebook with an encrypted
 * table and a readable one, and a school only the server writes. `note.create` refuses a fourth
 * note, so a replay onto rows from another device can fail where the first run passed.
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Sync } from "../../definition/Sync.ts";
import { Tx } from "../../transaction/Tx.ts";

export * as Notes from "./Notes.ts";

export const Notebook = Sync.spaceKind("notebook", {
  encryption: "sealed",
  roles: ["owner", "guest"],
});

export const School = Sync.spaceKind("school", {
  encryption: "none",
  roles: ["reader"],
  writtenBy: "server",
});

export const Note = Sync.table("Note", {
  class: "encrypted",
  fields: { title: Schema.String, done: Schema.optional(Schema.Boolean) },
  indexes: ["title"],
  writableBy: { notebook: ["owner"] },
});

export const Choice = Sync.table("Choice", {
  class: "readable",
  fields: { course: Schema.String },
  writableBy: { notebook: ["owner"] },
});

export const Course = Sync.table("Course", {
  class: "readable",
  fields: { name: Schema.String },
});

/** A notebook holds at most this many notes. */
export const limit = 3;

export class Full extends Schema.TaggedError<Full, { readonly brand: unique symbol }>()(
  "Notes.Full",
  {},
) {}

export class NotOffered extends Schema.TaggedError<NotOffered, { readonly brand: unique symbol }>()(
  "Notes.NotOffered",
  { course: Schema.String },
) {}

const NoteArgs = Schema.Struct({ notebook: Schema.String, id: Schema.String });

export const create = Sync.mutator("note.create", {
  version: 1,
  args: Schema.Struct({ ...NoteArgs.fields, title: Schema.String }),
  error: Full,
  writes: [Note],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Notes.create")(function* (args) {
    const tx = yield* Tx.Service;

    if ((yield* tx.list(Note, args.notebook)).length >= limit) return yield* new Full();
    yield* tx.insert(Note, args.notebook, args.id, { title: args.title });
  }),
});

export const rename = Sync.mutator("note.rename", {
  version: 1,
  args: Schema.Struct({ ...NoteArgs.fields, title: Schema.String }),
  writes: [Note],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Notes.rename")(function* (args) {
    yield* (yield* Tx.Service).patch(Note, args.notebook, args.id, { title: args.title });
  }),
});

export const remove = Sync.mutator("note.remove", {
  version: 1,
  args: NoteArgs,
  writes: [Note],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Notes.remove")(function* (args) {
    yield* (yield* Tx.Service).remove(Note, args.notebook, args.id);
  }),
});

/** Chooses a course the school offers, as `enrollment.set` does: a readable command. */
export const choose = Sync.mutator("choice.set", {
  version: 1,
  args: Schema.Struct({ notebook: Schema.String, school: Schema.String, course: Schema.String }),
  error: NotOffered,
  writes: [Choice],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Notes.choose")(function* (args) {
    const tx = yield* Tx.Service;
    const course = yield* tx.get(Course, args.school, args.course);

    if (course._tag === "None") return yield* new NotOffered({ course: args.course });
    yield* tx.put(Choice, args.notebook, args.notebook, { course: args.course });
  }),
});

export const schema = Sync.schema({
  version: 1,
  spaceKinds: [Notebook, School],
  tables: [Note, Choice, Course],
  mutators: [create, rename, remove, choose],
});

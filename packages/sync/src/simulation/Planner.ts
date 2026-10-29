/**
 * The simulation's own domain, shaped like M1's and small enough to hold every path the engine
 * has: sealed inserts, patches and deletes, a readable command the server runs again and may
 * refuse, a membership rule, spaces only the server writes, and a refusal that a replay onto
 * another device's rows can hit although the first run passed (`Planner.Full`).
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Sync } from "../definition/Sync.ts";
import { Tx } from "../transaction/Tx.ts";

export * as Planner from "./Planner.ts";

export const Notebook = Sync.spaceKind("notebook", { encryption: "sealed", roles: ["owner"] });

export const School = Sync.spaceKind("school", {
  encryption: "none",
  roles: ["reader"],
  writtenBy: "server",
});

export const Course = Sync.spaceKind("course", {
  encryption: "none",
  roles: ["reader"],
  writtenBy: "server",
});

/** A note's title holds a `Leaks.marker`, which must never reach the server in plaintext. */
export const Note = Sync.table("Note", {
  class: "encrypted",
  fields: { course: Schema.String, title: Schema.String, done: Schema.optional(Schema.Boolean) },
  indexes: ["course"],
  writableBy: { notebook: ["owner"] },
});

/** The courses a student chose at their school, one row per notebook with the id `choice`. */
export const Choice = Sync.table("Choice", {
  class: "readable",
  fields: { school: Schema.String, courses: Schema.Array(Schema.String) },
  writableBy: { notebook: ["owner"] },
});

/** A course the school offers, in the school's space, by the course's space id. */
export const Offer = Sync.table("Offer", { class: "readable", fields: { name: Schema.String } });

/** Something the course's members read, so joining and leaving a course shows in its rows. */
export const Topic = Sync.table("Topic", { class: "readable", fields: { title: Schema.String } });

/** The one `Choice` row's id. */
export const choiceId = "choice";

/** A course holds at most this many notes per notebook. */
export const limit = 3;

export class Full extends Schema.TaggedError<Full, { readonly brand: unique symbol }>()(
  "Planner.Full",
  { course: Schema.String },
) {}

export class NotChosen extends Schema.TaggedError<NotChosen, { readonly brand: unique symbol }>()(
  "Planner.NotChosen",
  { course: Schema.String },
) {}

export class NotOffered extends Schema.TaggedError<NotOffered, { readonly brand: unique symbol }>()(
  "Planner.NotOffered",
  { course: Schema.String },
) {}

const InNotebook = { notebook: Schema.String, id: Schema.String };

export const add = Sync.mutator("note.add", {
  version: 1,
  args: Schema.Struct({ ...InNotebook, course: Schema.String, title: Schema.String }),
  error: Schema.Union([Full, NotChosen]),
  writes: [Note],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Planner.add")(function* (args) {
    const tx = yield* Tx.Service;
    const choice = yield* tx.get(Choice, args.notebook, choiceId);

    if (choice._tag === "None" || !choice.value.courses.includes(args.course)) {
      return yield* new NotChosen({ course: args.course });
    }

    const notes = yield* tx.list(Note, args.notebook, { index: "course", equals: args.course });

    if (notes.length >= limit) return yield* new Full({ course: args.course });
    yield* tx.insert(Note, args.notebook, args.id, { course: args.course, title: args.title });
  }),
});

export const rename = Sync.mutator("note.rename", {
  version: 1,
  args: Schema.Struct({ ...InNotebook, title: Schema.String }),
  writes: [Note],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Planner.rename")(function* (args) {
    yield* (yield* Tx.Service).patch(Note, args.notebook, args.id, { title: args.title });
  }),
});

export const toggle = Sync.mutator("note.toggle", {
  version: 1,
  args: Schema.Struct({ ...InNotebook, done: Schema.Boolean }),
  writes: [Note],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Planner.toggle")(function* (args) {
    yield* (yield* Tx.Service).patch(Note, args.notebook, args.id, {
      done: args.done ? true : undefined,
    });
  }),
});

export const remove = Sync.mutator("note.remove", {
  version: 1,
  args: Schema.Struct(InNotebook),
  writes: [Note],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Planner.remove")(function* (args) {
    yield* (yield* Tx.Service).remove(Note, args.notebook, args.id);
  }),
});

/** Chooses courses the school offers, as `enrollment.set` does: the server runs it again. */
export const choose = Sync.mutator("choice.set", {
  version: 1,
  args: Schema.Struct({
    notebook: Schema.String,
    school: Schema.String,
    courses: Schema.Array(Schema.String),
  }),
  error: NotOffered,
  writes: [Choice],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Planner.choose")(function* (args) {
    const tx = yield* Tx.Service;

    for (const course of args.courses) {
      if ((yield* tx.get(Offer, args.school, course))._tag === "None") {
        return yield* new NotOffered({ course });
      }
    }

    yield* tx.put(Choice, args.notebook, choiceId, { school: args.school, courses: args.courses });
  }),
});

/** A notebook's owner reads the courses its `Choice` names. */
export const courses = Sync.membershipRule({
  kind: Course,
  role: "reader",
  from: Choice,
  spaces: (rows) => rows.flatMap(({ row }) => row.courses),
});

export const schema = Sync.schema({
  version: 1,
  spaceKinds: [Notebook, School, Course],
  tables: [Note, Choice, Offer, Topic],
  mutators: [add, rename, toggle, remove, choose],
  membership: [courses],
});

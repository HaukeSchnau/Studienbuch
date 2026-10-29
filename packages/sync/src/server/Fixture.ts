/**
 * A small definition in the shape of M1's domain, and a fresh PostgreSQL 18 database with the
 * engine's tables, for the server engine's tests.
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { Sync } from "../definition/Sync.ts";
import { Postgres18 } from "../testing/Postgres18.ts";
import { Tx } from "../transaction/Tx.ts";
import { ServerDatabase } from "./ServerDatabase.ts";
import { SyncServer } from "./SyncServer.ts";

export * as Fixture from "./Fixture.ts";

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

export const Homework = Sync.table("Homework", {
  class: "encrypted",
  fields: { title: Schema.String },
  writableBy: { notebook: ["owner"] },
});

export const Enrollment = Sync.table("Enrollment", {
  class: "readable",
  fields: { courseIds: Schema.Array(Schema.String) },
  writableBy: { notebook: ["owner"] },
});

export const Lesson = Sync.table("Lesson", {
  class: "readable",
  fields: { room: Schema.String, day: Schema.String },
  indexes: ["day"],
});

export class UnknownCourse extends Schema.TaggedError<
  UnknownCourse,
  { readonly brand: unique symbol }
>()("Enrollment.UnknownCourse", { courseId: Schema.String }) {}

/** Chooses courses. A course id starting with `x` doesn't exist, so the server refuses it. */
export const setEnrollment = Sync.mutator("enrollment.set", {
  version: 1,
  args: Schema.Struct({
    notebook: Schema.String,
    id: Schema.String,
    courseIds: Schema.Array(Schema.String),
  }),
  error: UnknownCourse,
  writes: [Enrollment],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Fixture.setEnrollment")(function* (args) {
    const tx = yield* Tx.Service;
    const unknown = args.courseIds.find((id) => id.startsWith("x"));

    if (unknown !== undefined) return yield* new UnknownCourse({ courseId: unknown });
    yield* tx.put(Enrollment, args.notebook, args.id, { courseIds: args.courseIds });
  }),
});

export const createHomework = Sync.mutator("homework.create", {
  version: 1,
  args: Schema.Struct({ notebook: Schema.String, id: Schema.String, title: Schema.String }),
  writes: [Homework],
  spaces: (args) => [args.notebook],
  run: Effect.fn("Fixture.createHomework")(function* (args) {
    const tx = yield* Tx.Service;
    yield* tx.insert(Homework, args.notebook, args.id, { title: args.title });
  }),
});

export const courses = Sync.membershipRule({
  kind: Course,
  role: "reader",
  from: Enrollment,
  spaces: (rows) => rows.flatMap(({ row }) => row.courseIds),
});

export const definition = Sync.schema({
  version: 1,
  spaceKinds: [Notebook, School, Course],
  tables: [Homework, Enrollment, Lesson],
  mutators: [setEnrollment, createHomework],
  membership: [courses],
});

/** A database of its own on the run's PostgreSQL 18, with the engine's tables. */
export const database = Layer.effectDiscard(ServerDatabase.create).pipe(
  Layer.provideMerge(Postgres18.database(Postgres18.socket ?? "")),
);

/** The engine's services over {@link database}. */
export const server = SyncServer.layer(definition).pipe(Layer.provideMerge(database));

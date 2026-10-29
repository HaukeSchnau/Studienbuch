import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { CanonicalJson } from "../transaction/CanonicalJson.ts";
import { Tx } from "../transaction/Tx.ts";
import { Sync } from "./Sync.ts";

const Notebook = Sync.spaceKind("notebook", { encryption: "sealed", roles: ["owner"] });

const School = Sync.spaceKind("school", {
  encryption: "none",
  roles: ["reader"],
  writtenBy: "server",
});

const Course = Sync.spaceKind("course", {
  encryption: "none",
  roles: ["reader"],
  writtenBy: "server",
});

const Homework = Sync.table("Homework", {
  class: "encrypted",
  fields: { title: Schema.String },
  writableBy: { notebook: ["owner"] },
});

const Enrollment = Sync.table("Enrollment", {
  class: "readable",
  fields: { courseIds: Schema.Array(Schema.String) },
  writableBy: { notebook: ["owner"] },
});

const Lesson = Sync.table("Lesson", { class: "readable", fields: { room: Schema.String } });

const Args = Schema.Struct({ notebook: Schema.String, id: Schema.String });

const createHomework = Sync.mutator("homework.create", {
  version: 1,
  args: Args,
  writes: [Homework],
  spaces: (args) => [args.notebook],
  run: () => Effect.void,
});

const setEnrollment = Sync.mutator("enrollment.set", {
  version: 1,
  args: Args,
  writes: [Enrollment],
  spaces: (args) => [args.notebook],
  run: () => Effect.void,
});

const courses = Sync.membershipRule({
  kind: Course,
  role: "reader",
  from: Enrollment,
  spaces: (rows) => rows.flatMap(({ row }) => row.courseIds),
});

const valid = {
  version: 1,
  spaceKinds: [Notebook, School, Course],
  tables: [Homework, Enrollment, Lesson],
  mutators: [createHomework, setEnrollment],
  membership: [courses],
};

const failure = (parts: Partial<Parameters<typeof Sync.schema>[0]>) =>
  Result.match(Sync.validate(Sync.schema({ ...valid, ...parts })), {
    onSuccess: () => null,
    onFailure: ({ reason, subject }) => ({ reason, subject }),
  });

describe("Sync.validate", () => {
  it("accepts a definition that keeps every rule", () => {
    expect(failure({})).toBeNull();
  });

  it("derives the mode from the class of the tables a mutator writes, and finds it only there", () => {
    const { Mutate, Seal } = Sync.schema(valid).byName.mutators;

    expect([createHomework.mode, setEnrollment.mode]).toEqual(["Seal", "Mutate"]);
    expect([Mutate.has("homework.create"), Seal.has("homework.create")]).toEqual([false, true]);
  });

  it.each([
    {
      name: "a field named space",
      parts: {
        tables: [
          // @ts-expect-error a device view's `space` column holds the row's space
          Sync.table("Note", { class: "readable", fields: { space: Schema.String } }),
        ],
      },
      expected: { reason: "reserved-name", subject: "table Note.space" },
    },
    {
      name: "a field named id",
      parts: {
        tables: [
          // @ts-expect-error a device view's `id` column holds the row's id
          Sync.table("Note", { class: "readable", fields: { id: Schema.String } }),
        ],
      },
      expected: { reason: "reserved-name", subject: "table Note.id" },
    },
    {
      name: "a table name of the engine",
      parts: { tables: [Sync.table("_key", { class: "readable", fields: {} })] },
      expected: { reason: "reserved-name", subject: "table _key" },
    },
    {
      name: "two tables with one name",
      parts: {
        tables: [
          Homework,
          Enrollment,
          Lesson,
          Sync.table("Lesson", { class: "readable", fields: {} }),
        ],
      },
      expected: { reason: "duplicate", subject: "table names" },
    },
    {
      name: "a mutator writing a table the schema doesn't list",
      parts: { tables: [Homework, Lesson], membership: [] },
      expected: { reason: "undeclared", subject: "mutator enrollment.set writes Enrollment" },
    },
    {
      name: "a table writable in an undeclared space kind",
      parts: { spaceKinds: [School, Course] },
      expected: { reason: "undeclared", subject: "table Homework in space kind notebook" },
    },
    {
      name: "a role the space kind doesn't have",
      parts: {
        tables: [
          Homework,
          Enrollment,
          Sync.table("Lesson", {
            class: "readable",
            fields: {},
            writableBy: { notebook: ["teacher"] },
          }),
        ],
        mutators: [],
      },
      expected: { reason: "undeclared", subject: "table Lesson, role teacher" },
    },
    {
      name: "a mutator writing a readable and an encrypted table",
      parts: {
        mutators: [
          Sync.mutator("mixed.write", {
            version: 1,
            args: Args,
            // @ts-expect-error a command carries one mode, so its tables share one class
            writes: [Homework, Enrollment],
            spaces: (args) => [args.notebook],
            run: () => Effect.void,
          }),
        ],
      },
      expected: { reason: "mixed-classes", subject: "mutator mixed.write" },
    },
    {
      name: "a role writing in a space only the server writes",
      parts: {
        tables: [
          Homework,
          Enrollment,
          Sync.table("Lesson", {
            class: "readable",
            fields: {},
            writableBy: { course: ["reader"] },
          }),
        ],
      },
      expected: { reason: "not-writable", subject: "table Lesson in course" },
    },
    {
      name: "a mutator writing a table only the server writes",
      parts: {
        mutators: [
          Sync.mutator("lesson.move", {
            version: 1,
            args: Args,
            writes: [Lesson],
            spaces: (args) => [args.notebook],
            run: () => Effect.void,
          }),
        ],
      },
      expected: { reason: "not-writable", subject: "mutator lesson.move writes Lesson" },
    },
    {
      name: "an encrypted table in a space kind without keys",
      parts: {
        spaceKinds: [Sync.spaceKind("notebook", { encryption: "none", roles: ["owner"] }), Course],
        tables: [Homework],
        mutators: [],
        membership: [],
      },
      expected: { reason: "encryption", subject: "table Homework in notebook" },
    },
    {
      name: "a name longer than the wire allows",
      parts: {
        tables: [
          Homework,
          Enrollment,
          Sync.table("L".repeat(65), { class: "readable", fields: {} }),
        ],
      },
      expected: { reason: "out-of-bounds", subject: `name ${"L".repeat(65)}` },
    },
    {
      name: "a mutator version below 1",
      parts: {
        mutators: [
          Sync.mutator("homework.undo", {
            version: 0,
            args: Args,
            writes: [Homework],
            spaces: (args) => [args.notebook],
            run: () => Effect.void,
          }),
        ],
      },
      expected: { reason: "out-of-bounds", subject: "mutator homework.undo, version 0" },
    },
    {
      name: "encrypted tables of one space kind that different roles write",
      parts: {
        spaceKinds: [
          Sync.spaceKind("notebook", { encryption: "sealed", roles: ["owner", "parent"] }),
          School,
          Course,
        ],
        tables: [
          Homework,
          Enrollment,
          Sync.table("Signature", {
            class: "encrypted",
            fields: {},
            writableBy: { notebook: ["owner", "parent"] },
          }),
        ],
        mutators: [],
        membership: [],
      },
      expected: { reason: "encryption", subject: "roles writing encrypted tables in notebook" },
    },
    {
      name: "a membership rule over an encrypted table",
      parts: {
        membership: [
          Sync.membershipRule({ kind: Course, role: "reader", from: Homework, spaces: () => [] }),
        ],
      },
      expected: { reason: "encryption", subject: "membership rule for course from Homework" },
    },
  ])("refuses $name", ({ parts, expected }) => {
    expect(failure(parts)).toEqual(expected);
  });
});

describe("Sync.invoke", () => {
  it.effect("binds arguments of the mutator's own version and names any other", () =>
    Effect.gen(function* () {
      const args = { notebook: "n", id: "h" };
      const bound = yield* Sync.invoke(createHomework, 1, args);
      const newer = yield* Effect.flip(Sync.invoke(createHomework, 2, args));
      const older = yield* Effect.flip(Sync.invoke(createHomework, 0, args));

      expect([bound.spaces, newer._tag, older._tag]).toEqual([
        ["n"],
        "Sync.NewerVersion",
        "Sync.OlderVersion",
      ]);
    }),
  );
});

/** A server `Tx` over rows held in memory, enough to read a space's rows. */
const memoryTx = (rows: ReadonlyArray<{ readonly id: string; readonly row: unknown }>) =>
  Tx.make({
    actor: "server",
    location: "server",
    writes: [],
    read: () => Effect.succeedNone,
    list: () =>
      Effect.succeed(
        rows.map(({ id, row }) => ({
          id,
          data: Result.getOrElse(CanonicalJson.encode(row), () => ""),
        })),
      ),
    write: () => Effect.void,
  });

describe("Sync.grants", () => {
  it.effect(
    "keeps only existing spaces of the rule's kind, so a notebook's id grants nothing",
    () =>
      Effect.gen(function* () {
        const kinds = new Map([
          ["course-ma", "course"],
          ["course-de", "course"],
          ["notebook-tom", "notebook"],
        ]);

        const existing = (kind: string, spaces: ReadonlyArray<string>) =>
          Effect.succeed(spaces.filter((space) => kinds.get(space) === kind));

        const granted = yield* Sync.grants(courses, "notebook-lena", existing).pipe(
          Effect.provideService(
            Tx.Service,
            memoryTx([
              { id: "e1", row: { courseIds: ["course-ma", "notebook-tom"] } },
              { id: "e2", row: { courseIds: ["course-ma", "course-de", "course-gone"] } },
            ]),
          ),
        );

        expect(granted).toEqual(["course-ma", "course-de"]);
      }),
  );
});

describe("Sync.schema", () => {
  it("hashes the contract regardless of declaration order, and a new field changes it", () => {
    const reordered = Sync.schema({
      ...valid,
      spaceKinds: [Course, School, Notebook],
      tables: [Lesson, Enrollment, Homework],
      mutators: [setEnrollment, createHomework],
    });

    const extended = Sync.schema({
      ...valid,
      tables: [
        Homework,
        Enrollment,
        Sync.table("Lesson", {
          class: "readable",
          fields: { room: Schema.String, note: Schema.optionalKey(Schema.String) },
        }),
      ],
      mutators: [createHomework, setEnrollment],
    });

    const { hash } = Sync.schema(valid).contract;

    expect([reordered.contract.hash, extended.contract.hash === hash]).toEqual([hash, false]);
  });
});

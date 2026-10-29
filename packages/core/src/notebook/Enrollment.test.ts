import { describe, expect, it } from "@effect/vitest";
import { Sync } from "@stu/sync";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { Course } from "../school/Course.ts";
import { SchoolClass } from "../school/SchoolClass.ts";
import { Term } from "../school/Term.ts";
import { Fixture } from "../testing/Fixture.ts";
import type { MemoryTx } from "../testing/MemoryTx.ts";
import { Enrollment } from "./Enrollment.ts";
import { Notebook } from "./Notebook.ts";

const { notebook, term } = Fixture;

const choice = {
  notebook,
  termId: term,
  gradeLevel: 11,
  classId: Fixture.class112,
  courseIds: [Fixture.mathE, Fixture.german],
};

const stored = (db: MemoryTx.Database) =>
  Option.getOrUndefined(db.stored(notebook, Enrollment.Row.name, term));

/** The Course spaces the import created. Kunst has none, so no rule may grant it. */
const courseSpaces = new Set<string>([Fixture.mathE, Fixture.mathG, Fixture.german]);

const granted = (db: MemoryTx.Database) =>
  db.transaction(
    { actor: "server", writes: [], location: "server" },
    Sync.grants(Enrollment.courseMembership, notebook, (_kind, spaces) =>
      Effect.succeed(spaces.filter((space) => courseSpaces.has(space))),
    ),
  );

describe("enrollment.set", () => {
  it.effect.each(["client", "server"] as const)(
    "chooses a term's courses and replaces the whole choice later, alike on the %s",
    (location) =>
      Effect.gen(function* () {
        const db = yield* Fixture.make;

        const twelfth = {
          ...choice,
          gradeLevel: 12,
          classId: undefined,
          courseIds: [Fixture.art],
        };

        const twelfthStored = {
          termId: "demo-2026-27-winter",
          gradeLevel: 12,
          courseIds: ["demo-ku"],
        };

        yield* Fixture.run(db, Enrollment.set, twelfth, location);
        expect(stored(db)).toEqual(twelfthStored);

        yield* Fixture.run(
          db,
          Enrollment.set,
          { ...choice, courseIds: [Fixture.mathE, Fixture.german, Fixture.mathE] },
          location,
        );

        expect(stored(db)).toEqual({
          termId: "demo-2026-27-winter",
          gradeLevel: 11,
          classId: "demo-11.2",
          courseIds: ["demo-de-11.2", "demo-ma-e"],
        });

        yield* Fixture.run(db, Enrollment.set, twelfth, location);
        expect(stored(db)).toEqual(twelfthStored);
      }),
  );

  it.effect.each([
    {
      name: "a term the school doesn't have",
      args: { ...choice, termId: Term.Id.make("demo-2025-26-winter") },
      refusal: Enrollment.UnknownTerm,
    },
    {
      name: "another school's term",
      args: { ...choice, termId: Fixture.otherTerm, courseIds: [Fixture.otherMath] },
      refusal: Enrollment.UnknownTerm,
    },
    {
      name: "a notebook the server never admitted",
      args: { ...choice, notebook: Notebook.Id.make("notebook-forged") },
      refusal: Enrollment.UnknownTerm,
    },
    {
      name: "no class, where the grade level has classes",
      args: { ...choice, classId: undefined, courseIds: [Fixture.mathE] },
      refusal: Enrollment.ClassRequired,
    },
    {
      name: "a class of another grade level",
      args: { ...choice, gradeLevel: 12, courseIds: [Fixture.art] },
      refusal: Enrollment.ClassRequired,
    },
    {
      name: "an unknown class",
      args: { ...choice, classId: SchoolClass.Id.make("demo-11.9") },
      refusal: Enrollment.ClassRequired,
    },
    {
      name: "a course for another class",
      args: { ...choice, classId: Fixture.class111 },
      refusal: Enrollment.CourseNotOffered,
    },
    {
      name: "a course for other grade levels",
      args: { ...choice, courseIds: [Fixture.mathE, Fixture.art] },
      refusal: Enrollment.CourseNotOffered,
    },
    {
      name: "a course offered in another term",
      args: { ...choice, termId: Fixture.nextTerm, courseIds: [Fixture.mathE] },
      refusal: Enrollment.CourseNotOffered,
    },
    {
      name: "another school's course",
      args: { ...choice, courseIds: [Fixture.mathE, Fixture.otherMath] },
      refusal: Enrollment.CourseNotOffered,
    },
    {
      name: "a course the school doesn't have",
      args: { ...choice, courseIds: [Course.Id.make("demo-ph-e")] },
      refusal: Enrollment.CourseNotOffered,
    },
    {
      name: "two courses of one elective group",
      args: { ...choice, courseIds: [Fixture.mathE, Fixture.mathG] },
      refusal: Enrollment.TwoInOneGroup,
    },
  ])("refuses $name on the server, and writes nothing", ({ args, refusal }) =>
    Effect.gen(function* () {
      const db = yield* Fixture.make;
      const error = yield* Effect.flip(Fixture.run(db, Enrollment.set, args, "server"));

      expect(error).toBeInstanceOf(refusal);
      expect(
        Option.getOrUndefined(db.stored(args.notebook, Enrollment.Row.name, args.termId)),
      ).toBeUndefined();
    }),
  );
});

describe("Enrollment.courseMembership", () => {
  it.effect("grants the Course spaces a notebook chose, and takes back the ones it dropped", () =>
    Effect.gen(function* () {
      const db = yield* Fixture.make;

      expect(yield* granted(db)).toEqual([]);

      yield* Fixture.run(db, Enrollment.set, choice);
      expect(yield* granted(db)).toEqual(["demo-de-11.2", "demo-ma-e"]);

      yield* Fixture.run(db, Enrollment.set, { ...choice, courseIds: [Fixture.mathG] });
      expect(yield* granted(db)).toEqual(["demo-ma-g"]);

      yield* Fixture.run(db, Enrollment.set, { ...choice, courseIds: [] });
      expect(yield* granted(db)).toEqual([]);
    }),
  );
});

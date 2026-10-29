import { describe, expect, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";
import { Fixture } from "../testing/Fixture.ts";
import type { MemoryTx } from "../testing/MemoryTx.ts";
import { Homework } from "./Homework.ts";

const { date, notebook } = Fixture;

const id = Homework.Id.make("1b4e28ba-2fa1-41d2-883f-0016d3cca427");

const created = {
  notebook,
  id,
  courseId: Fixture.mathE,
  title: Homework.Title.make("Aufgaben 3 bis 5"),
  dueOn: date("2026-11-03"),
};

const stored = (db: MemoryTx.Database) =>
  Option.getOrUndefined(db.stored(notebook, Homework.Row.name, id));

/** A database where Lena chose MA-E and DE and holds one homework. */
const withHomework = Effect.gen(function* () {
  const db = yield* Fixture.make;

  yield* Fixture.enroll(db, [Fixture.mathE, Fixture.german]);
  yield* Fixture.run(db, Homework.create, created);

  return db;
});

const isId = Schema.is(Homework.Id);

describe("homework.create", () => {
  it.effect("adds homework for a course of one of the notebook's enrollments", () =>
    Effect.gen(function* () {
      const db = yield* withHomework;

      expect(stored(db)).toEqual({
        courseId: "demo-ma-e",
        title: "Aufgaben 3 bis 5",
        dueOn: "2026-11-03",
      });
    }),
  );

  it.effect("keeps a description it is given", () =>
    Effect.gen(function* () {
      const db = yield* Fixture.make;
      const description = Homework.Description.make("Seite 42, nur die geraden");

      yield* Fixture.enroll(db, [Fixture.mathE]);
      yield* Fixture.run(db, Homework.create, { ...created, description });

      expect(stored(db)).toMatchObject({ description: "Seite 42, nur die geraden" });
    }),
  );

  it.effect("refuses a course that no enrollment lists, and writes nothing", () =>
    Effect.gen(function* () {
      const db = yield* Fixture.make;

      yield* Fixture.enroll(db, [Fixture.mathG]);
      const error = yield* Effect.flip(Fixture.run(db, Homework.create, created));

      expect(error).toBeInstanceOf(Homework.CourseNotChosen);
      expect(error).toMatchObject({ courseId: "demo-ma-e" });
      expect(stored(db)).toBeUndefined();
    }),
  );

  it("takes random ids only, which tell the server nothing about when a row was made", () => {
    expect(isId("1b4e28ba-2fa1-41d2-883f-0016d3cca427")).toBe(true);
    expect(isId("019a2f4e-8b1c-7d3e-9f00-1234567890ab")).toBe(false);
  });
});

describe("homework.update", () => {
  it.effect("changes the fields it is given and keeps the rest, also a newer app's field", () =>
    Effect.gen(function* () {
      const db = yield* Fixture.make;

      yield* Fixture.enroll(db, [Fixture.mathE, Fixture.german]);
      yield* db.seed(notebook, Homework.Row.name, id, {
        courseId: "demo-ma-e",
        title: "Aufgaben 3 bis 5",
        dueOn: "2026-11-03",
        photos: [{ hash: "abc", type: "image/jpeg" }],
      });

      yield* Fixture.run(db, Homework.update, {
        notebook,
        id,
        courseId: Fixture.german,
        title: Homework.Title.make("Gedicht lernen"),
      });

      expect(stored(db)).toEqual({
        courseId: "demo-de-11.2",
        title: "Gedicht lernen",
        dueOn: "2026-11-03",
        photos: [{ hash: "abc", type: "image/jpeg" }],
      });
    }),
  );

  it.effect("removes the description when given null", () =>
    Effect.gen(function* () {
      const db = yield* withHomework;
      const description = Homework.Description.make("Seite 42");

      yield* Fixture.run(db, Homework.update, { notebook, id, description });
      expect(stored(db)).toMatchObject({ description: "Seite 42" });

      yield* Fixture.run(db, Homework.update, { notebook, id, description: null });
      expect(stored(db)).not.toHaveProperty("description");
    }),
  );

  it.effect("still edits homework of a course the student dropped, given that same course", () =>
    Effect.gen(function* () {
      const db = yield* withHomework;

      yield* Fixture.enroll(db, [Fixture.german]);
      yield* Fixture.run(db, Homework.update, {
        notebook,
        id,
        courseId: Fixture.mathE,
        title: Homework.Title.make("Aufgaben 3 bis 6"),
      });

      expect(stored(db)).toMatchObject({ courseId: "demo-ma-e", title: "Aufgaben 3 bis 6" });
    }),
  );

  it.effect("refuses homework that is gone", () =>
    Effect.gen(function* () {
      const db = yield* Fixture.make;
      const error = yield* Effect.flip(Fixture.run(db, Homework.update, { notebook, id }));

      expect(error).toBeInstanceOf(Homework.NotFound);
      expect(error).toMatchObject({ id });
    }),
  );

  it.effect("refuses moving homework to a course that no enrollment lists", () =>
    Effect.gen(function* () {
      const db = yield* withHomework;

      const error = yield* Effect.flip(
        Fixture.run(db, Homework.update, { notebook, id, courseId: Fixture.mathG }),
      );

      expect(error).toBeInstanceOf(Homework.CourseNotChosen);
      expect(error).toMatchObject({ courseId: "demo-ma-g" });
      expect(stored(db)).toMatchObject({ courseId: "demo-ma-e" });
    }),
  );
});

describe("homework.setDone", () => {
  it.effect("marks homework done, and reopens it without a date", () =>
    Effect.gen(function* () {
      const db = yield* withHomework;

      yield* Fixture.run(db, Homework.setDone, { notebook, id, doneOn: date("2026-11-02") });
      expect(stored(db)).toMatchObject({ doneOn: "2026-11-02" });

      yield* Fixture.run(db, Homework.setDone, { notebook, id });
      expect(stored(db)).not.toHaveProperty("doneOn");
    }),
  );

  it.effect("refuses homework that is gone", () =>
    Effect.gen(function* () {
      const db = yield* Fixture.make;

      const error = yield* Effect.flip(
        Fixture.run(db, Homework.setDone, { notebook, id, doneOn: date("2026-11-02") }),
      );

      expect(error).toBeInstanceOf(Homework.NotFound);
      expect(error).toMatchObject({ id });
    }),
  );
});

describe("homework.delete", () => {
  it.effect("deletes homework, and deleting it again succeeds", () =>
    Effect.gen(function* () {
      const db = yield* withHomework;

      yield* Fixture.run(db, Homework.delete, { notebook, id });
      yield* Fixture.run(db, Homework.delete, { notebook, id });

      expect(stored(db)).toBeUndefined();
    }),
  );
});

describe("Homework display rules", () => {
  const today = date("2026-10-29");

  const homework = (id: string, dueOn: string, doneOn?: string): Homework.Listed => ({
    id,
    dueOn: date(dueOn),
    doneOn: doneOn === undefined ? undefined : date(doneOn),
  });

  it("lists open homework before done, each by due date, then by id", () => {
    const listed = [
      homework("a", "2026-10-30", "2026-10-28"),
      homework("b", "2026-11-05"),
      homework("d", "2026-10-31"),
      homework("c", "2026-10-31"),
      homework("e", "2026-10-20", "2026-10-19"),
    ];

    expect(Arr.sort(listed, Homework.order).map(({ id }) => id)).toEqual(["c", "d", "b", "e", "a"]);
  });

  it.each([
    { name: "open and due yesterday", item: homework("x", "2026-10-28"), overdue: true },
    { name: "open and due today", item: homework("x", "2026-10-29"), overdue: false },
    {
      name: "done and due yesterday",
      item: homework("x", "2026-10-28", "2026-10-29"),
      overdue: false,
    },
  ])("marks homework that is $name as overdue: $overdue", ({ item, overdue }) => {
    expect(Homework.isOverdue(item, today)).toBe(overdue);
  });

  it.each([
    { name: "open, 7 days past due", item: homework("x", "2026-10-22"), dimmed: false },
    { name: "open, 8 days past due", item: homework("x", "2026-10-21"), dimmed: true },
    { name: "done, due tomorrow", item: homework("x", "2026-10-30", "2026-10-29"), dimmed: true },
  ])("dims homework that is $name: $dimmed", ({ item, dimmed }) => {
    expect(Homework.isDimmed(item, today)).toBe(dimmed);
  });

  it("offers due dates from today to 365 days ahead", () => {
    const { start, end } = Homework.dueDates(today);

    expect([start, end].map((day) => PlainDateFns.toString(day))).toEqual([
      "2026-10-29",
      "2027-10-29",
    ]);
  });
});

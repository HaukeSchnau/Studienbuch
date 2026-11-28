import { assert, describe, it } from "@effect/vitest";
import { Course, SchoolClass, Term } from "@stu/core";
import { SchoolImport } from "./SchoolImport.ts";

const lesson = (id: string, date: string): SchoolImport.ImportedLesson => ({
  id,
  courseId: Course.Id.make("MA/12"),
  date,
  start: 0,
  end: 1,
  teacherIds: [],
  roomIds: [],
  status: "Regular",
});

const stored: SchoolImport.ImportResult = {
  ...SchoolImport.empty,
  lessons: [lesson("monday", "2026-11-02"), lesson("next-week", "2026-11-09")],
  closures: [{ id: "autumn", name: "Herbstferien", start: "2026-10-12", end: "2026-10-23" }],
  links: [
    { id: "monday", refs: [] },
    { id: "next-week", refs: [] },
    { id: "autumn", refs: [] },
  ],
};

const week = { start: "2026-11-02", end: "2026-11-08" };

describe("SchoolImport.apply", () => {
  it.each([
    {
      name: "replaces the lessons of a week the run read completely",
      covers: [{ rows: "lessons" as const, ...week }],
      unattributed: [],
      lessons: ["next-week", "tuesday"],
    },
    {
      name: "deletes nothing the run didn't read completely",
      covers: [{ rows: "exams" as const, ...week }],
      unattributed: [],
      lessons: ["monday", "next-week", "tuesday"],
    },
    {
      // Monday's entry may be the one no known course claimed.
      name: "keeps the lessons of a day with an entry it couldn't attribute",
      covers: [{ rows: "lessons" as const, ...week }],
      unattributed: [{ date: "2026-11-02", ids: [7] }],
      lessons: ["monday", "next-week", "tuesday"],
    },
  ])("$name", ({ covers, unattributed, lessons }) => {
    const after = SchoolImport.apply(stored, {
      ...SchoolImport.empty,
      lessons: [lesson("tuesday", "2026-11-03")],
      links: [{ id: "tuesday", refs: [] }],
      covers,
      unattributed,
    });

    assert.deepStrictEqual(
      {
        lessons: after.lessons.map(({ id }) => id),
        links: after.links.map(({ id }) => id).filter((id) => id !== "autumn"),
        covers: after.covers,
        unattributed: after.unattributed,
      },
      { lessons, links: lessons, covers: [], unattributed: [] },
    );
  });

  it.each([
    { cover: { start: "2026-08-13", end: "2027-07-07" }, closures: [] },
    { cover: { start: "2026-10-19", end: "2027-07-07" }, closures: ["autumn"] },
  ])("deletes a closure only when one cover holds its whole range", ({ cover, closures }) => {
    const after = SchoolImport.apply(stored, {
      ...SchoolImport.empty,
      covers: [{ rows: "closures", ...cover }],
    });

    assert.deepStrictEqual(
      after.closures.map(({ id }) => id),
      closures,
    );
  });

  const offering = (
    classIds: ReadonlyArray<string>,
    gradeLevels: ReadonlyArray<number>,
    groupKey?: string,
  ): SchoolImport.ImportedOffering => {
    const row = {
      id: "ma@2026-1",
      courseId: Course.Id.make("ma"),
      termId: Term.Id.make("2026-1"),
      gradeLevels,
      classIds: classIds.map((id) => SchoolClass.Id.make(id)),
    };

    return groupKey === undefined ? row : { ...row, groupKey };
  };

  // Enrollment.set reads an offering's grade levels, classes and group, so a choice it accepted
  // must stay one it accepts.
  it.each([
    {
      name: "grade levels and classes only grow",
      kept: offering(["11.1"], [11]),
      incoming: offering(["11.2"], [12]),
      after: offering(["11.1", "11.2"], [11, 12]),
    },
    {
      name: "no classes stays every class",
      kept: offering([], [11]),
      incoming: offering(["11.2"], [11]),
      after: offering([], [11]),
    },
    {
      name: "a course for some classes may open to all",
      kept: offering(["11.1"], [11]),
      incoming: offering([], [11]),
      after: offering([], [11]),
    },
    {
      name: "its elective group stays the one it had",
      kept: offering([], [12], "ma"),
      incoming: offering([], [12], "nw"),
      after: offering([], [12], "ma"),
    },
    {
      name: "a required course doesn't join a group",
      kept: offering([], [12]),
      incoming: offering([], [12], "nw"),
      after: offering([], [12]),
    },
    {
      // A group of one course never holds two chosen ones.
      name: "a required course may become a choice of its own",
      kept: offering([], [12]),
      incoming: offering([], [12], SchoolImport.ownGroup(Course.Id.make("ma"))),
      after: offering([], [12], "ma"),
    },
  ])("widens an offering: $name", ({ kept, incoming, after }) => {
    const state = SchoolImport.apply(
      { ...SchoolImport.empty, offerings: [kept] },
      { ...SchoolImport.empty, offerings: [incoming] },
    );

    assert.deepStrictEqual(state.offerings, [after]);
  });
});

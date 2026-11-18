import { assert, describe, it } from "@effect/vitest";
import { Course } from "@stu/core";
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
  links: [
    { id: "monday", refs: [] },
    { id: "next-week", refs: [] },
  ],
};

describe("SchoolImport.apply", () => {
  it.each([
    {
      name: "replaces the lessons of a week the run read completely",
      covers: [{ rows: "lessons" as const, start: "2026-11-02", end: "2026-11-08" }],
      lessons: ["next-week", "tuesday"],
    },
    {
      name: "deletes nothing the run didn't read completely",
      covers: [{ rows: "exams" as const, start: "2026-11-02", end: "2026-11-08" }],
      lessons: ["monday", "next-week", "tuesday"],
    },
  ])("$name", ({ covers, lessons }) => {
    const after = SchoolImport.apply(stored, {
      ...SchoolImport.empty,
      lessons: [lesson("tuesday", "2026-11-03")],
      links: [{ id: "tuesday", refs: [] }],
      covers,
    });

    assert.deepStrictEqual(
      { lessons: after.lessons.map(({ id }) => id), links: after.links.map(({ id }) => id) },
      { lessons, links: lessons },
    );
  });
});

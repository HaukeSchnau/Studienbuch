import { assert, describe, it } from "@effect/vitest";
import type { Metrics } from "./Metrics.ts";
import { Students } from "./Students.ts";

const lesson = (
  courseId: string,
  date: string,
  start = 0,
  claims: ReadonlyArray<number> = [],
): Metrics.Lesson => ({
  id: `${courseId} ${date} ${start}`,
  courseId,
  date,
  start,
  end: start + 1,
  status: "Regular",
  teachers: [],
  rooms: [],
  previousTeachers: [],
  previousRooms: [],
  kind: undefined,
  entries: claims.map((id) => ({ date, ids: [id] })),
});

const entry = (id: number, start: number): Metrics.TruthEntry => ({
  date: "2026-11-02",
  ids: [id],
  start,
  end: start + 1,
  status: "Regular",
  teachers: [],
  rooms: [],
  previousTeachers: [],
  previousRooms: [],
  subjects: ["MA"],
});

describe("Students.isExact", () => {
  // Two simultaneous rows, such as one course taught as two groups, in one lesson.
  const both = lesson("ma", "2026-11-02", 8, [1, 2]);

  it.each([
    { name: "one lesson for two simultaneous entries", lessons: [both], exact: true },
    {
      // It claims an entry of 08:00 at 10:00, which no entry matches.
      name: "a lesson at another time beside it",
      lessons: [both, lesson("ph", "2026-11-02", 10, [1])],
      exact: false,
    },
    {
      name: "two lessons for one entry",
      lessons: [both, lesson("inf", "2026-11-02", 8, [2])],
      exact: false,
    },
  ])("$name: $exact", ({ lessons, exact }) => {
    const chosen = new Set(lessons.map(({ courseId }) => courseId));

    assert.strictEqual(Students.isExact([entry(1, 8), entry(2, 8)], lessons, chosen), exact);
  });
});

describe("Students.ghosts", () => {
  it("counts a course nobody chose in a term, even when someone chose it in another", () => {
    assert.strictEqual(
      Students.ghosts([
        { lessons: [lesson("ma", "2026-11-02")], kurswahls: [new Set(["ma"])] },
        {
          lessons: [lesson("ma", "2027-02-01"), lesson("de", "2027-02-01")],
          kurswahls: [new Set(["de"])],
        },
      ]),
      1,
    );
  });
});

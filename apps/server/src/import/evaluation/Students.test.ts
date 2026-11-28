import { assert, describe, it } from "@effect/vitest";
import type { Metrics } from "./Metrics.ts";
import { Students } from "./Students.ts";
import type { Truth } from "./Truth.ts";

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
  classes: ["12"],
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

describe("Students.attended", () => {
  // Two weeks: Monday, Tuesday and Thursday of each.
  const weeks = [
    ["2026-11-02", "2026-11-09"],
    ["2026-11-03", "2026-11-10"],
    ["2026-11-05", "2026-11-12"],
  ];

  const [mondays = [], tuesdays = [], thursdays = []] = weeks;

  const meets = (dates: ReadonlyArray<string>, subject: string, teacher: number, start: number) =>
    dates.map((date, n) => ({
      ...entry(teacher * 100 + start * 10 + n, start),
      date,
      subjects: [subject],
      teachers: [teacher],
    }));

  const view = (id: number, entries: ReadonlyArray<Metrics.TruthEntry>): Truth.View => ({
    type: "STUDENT",
    id,
    name: `student ${id}`,
    entries,
    weeks: new Set(["2026-W45", "2026-W46"]),
    hidden: new Set(),
  });

  // Latin meets on Tuesdays for its students, and WebUntis shows its Thursday lunch slot to the
  // whole cohort, next to Spanish's: 25/26's grade 12.
  const latin = meets(tuesdays, "la1", 1, 8);
  const spanish = meets(mondays, "sn1", 2, 8);
  const latinLunch = meets(thursdays, "la1", 1, 13);
  const spanishLunch = meets(thursdays, "sn1", 2, 13);

  const tutor = meets(mondays, "Tutorium", 4, 13);
  const tutorWide = meets(tuesdays, "Tutorium", 4, 8);
  const tutorOnce = meets(thursdays.slice(0, 1), "Tutorium", 4, 8);

  const ownTutor = [
    ...meets(tuesdays, "Tutorium", 5, 8),
    ...meets(thursdays.slice(0, 1), "Tutorium", 5, 8),
  ];

  it.each([
    {
      name: "a lunch slot shown to the cohort stays with its group's students only",
      views: [
        view(1, [...latin, ...latinLunch, ...spanishLunch]),
        view(2, [...spanish, ...latinLunch, ...spanishLunch]),
        view(3, [...latinLunch, ...spanishLunch]),
      ],
      kept: [[...latin, ...latinLunch], [...spanish, ...spanishLunch], []],
    },
    {
      name: "a slot shown to a student alone stays theirs",
      views: [view(1, [...latin, ...latinLunch]), view(3, latinLunch)],
      kept: [[...latin, ...latinLunch], latinLunch],
    },
    {
      // A group with one slot has no other slot to say who is in it.
      name: "a group meeting in one slot stays with everyone it is shown to",
      views: [view(1, [...latinLunch, ...spanishLunch]), view(2, [...latinLunch, ...spanishLunch])],
      kept: [
        [...latinLunch, ...spanishLunch],
        [...latinLunch, ...spanishLunch],
      ],
    },
    {
      // 25/26's Tutorium: one tutor's group meets on Mondays, and WebUntis shows its other slots,
      // one of them in a single week, to another group meeting at the same time.
      name: "every slot shown beyond the group goes, also once the others went",
      views: [
        view(1, [...tutor, ...tutorWide, ...tutorOnce]),
        view(2, [...tutorWide, ...tutorOnce, ...ownTutor]),
      ],
      kept: [[...tutor, ...tutorWide, ...tutorOnce], ownTutor],
    },
    {
      // Study time shown to all of grade 13 in every slot, at the time of their maths.
      name: "a group shown to the same students in every slot loses nothing",
      views: [
        view(1, [...meets(tuesdays, "st1", 3, 8), ...meets(thursdays, "st1", 3, 13), ...latin]),
        view(2, [...meets(tuesdays, "st1", 3, 8), ...meets(thursdays, "st1", 3, 13)]),
      ],
      kept: [
        [...meets(tuesdays, "st1", 3, 8), ...meets(thursdays, "st1", 3, 13), ...latin],
        [...meets(tuesdays, "st1", 3, 8), ...meets(thursdays, "st1", 3, 13)],
      ],
    },
  ])("$name", ({ views, kept }) => {
    assert.deepStrictEqual(
      Students.attended(views, () => "2026-1").map(({ entries }) => entries),
      kept,
    );
  });
});

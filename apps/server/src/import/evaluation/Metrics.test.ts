import { assert, describe, it } from "@effect/vitest";
import { Metrics } from "./Metrics.ts";

const day = "2026-11-02";

const entry = (
  ids: ReadonlyArray<number>,
  changes: Partial<Metrics.TruthEntry> = {},
): Metrics.TruthEntry => ({
  date: day,
  ids,
  start: 28_800_000,
  end: 33_600_000,
  status: "Regular",
  teachers: [201],
  rooms: [301],
  previousTeachers: [],
  previousRooms: [],
  ...changes,
});

const lesson = (
  id: string,
  ids: ReadonlyArray<number>,
  changes: Partial<Metrics.Lesson> = {},
): Metrics.Lesson => ({
  id,
  courseId: "MA/12",
  date: day,
  start: 28_800_000,
  end: 33_600_000,
  status: "Regular",
  teachers: [201],
  rooms: [301],
  previousTeachers: [],
  previousRooms: [],
  kind: undefined,
  entries: [{ date: day, ids }],
  ...changes,
});

describe("Metrics.scoreView", () => {
  const truth = [entry([1]), entry([2, 3])];

  it.each([
    {
      name: "a lesson for every entry, every attribute right",
      ours: [lesson("a", [1]), lesson("b", [3])],
      score: { truth: 2, ours: 2, covered: 2, precise: 2, right: 2 },
      exact: true,
    },
    {
      name: "a missing lesson",
      ours: [lesson("a", [1])],
      score: { truth: 2, ours: 1, covered: 1, precise: 1, right: 1 },
      exact: false,
    },
    {
      name: "a second lesson for the same entry",
      ours: [lesson("a", [1]), lesson("b", [1]), lesson("c", [2])],
      score: { truth: 2, ours: 3, covered: 2, precise: 2, right: 2 },
      exact: false,
    },
    {
      name: "a lesson on another day",
      ours: [lesson("a", [1]), lesson("b", [2], { entries: [{ date: "2026-11-03", ids: [2] }] })],
      score: { truth: 2, ours: 2, covered: 1, precise: 1, right: 1 },
      exact: false,
    },
    {
      name: "a lesson on another day that claims the entry",
      ours: [lesson("a", [1], { date: "2026-11-03" }), lesson("b", [2])],
      score: { truth: 2, ours: 2, covered: 1, precise: 1, right: 1 },
      exact: false,
    },
    {
      name: "another teacher",
      ours: [lesson("a", [1], { teachers: [202] }), lesson("b", [2])],
      score: { truth: 2, ours: 2, covered: 2, precise: 2, right: 1 },
      exact: false,
    },
  ])("scores $name", ({ ours, score, exact }) => {
    const result = Metrics.scoreView(truth, ours);

    assert.deepStrictEqual({ result, exact: Metrics.isExact(result) }, { result: score, exact });
  });
});

describe("Metrics.scoreChanges", () => {
  const changes = [
    entry([1], { status: "Cancelled" }),
    entry([2], { status: "Changed", teachers: [205], previousTeachers: [201] }),
  ];

  const labels = [{ id: "supervision", date: day, entryIds: [2], kind: "Supervised" as const }];

  it.each([
    { name: "the labelled kind", kind: "Supervised" as const, right: 2, passing: ["supervision"] },
    { name: "another kind", kind: "Substitution" as const, right: 1, passing: [] },
  ])("counts a change right with $name", ({ kind, right, passing }) => {
    const ours = [
      lesson("a", [1], { status: "Cancelled", kind: "Cancelled" }),
      lesson("b", [2], { status: "Changed", teachers: [205], previousTeachers: [201], kind }),
    ];

    assert.deepStrictEqual(Metrics.scoreChanges(changes, labels, Metrics.byEntry(ours)), {
      score: Metrics.fraction(right, 2),
      passing,
    });
  });
});

describe("Metrics.scoreExams", () => {
  const enrollments = new Map([
    [501, new Set(["MA-E/12"])],
    [502, new Set(["MA-E/12"])],
    [503, new Set(["MA-E/12"])],
    [504, new Set(["DE/12"])],
  ]);

  const truth = [
    {
      id: 901,
      date: day,
      start: 0,
      end: 1,
      students: [501, 502],
      teachers: [203],
      subject: "MA-E",
    },
  ];

  const exam = { id: "exam-1", courseId: "MA-E/12", date: day, start: 0, end: 1, examIds: [901] };

  const teachers = new Map([
    ["MA-E/12", new Set([203])],
    ["MA-E/13", new Set([204])],
    ["PH/12", new Set([203])],
  ]);

  const subjects = new Map([
    ["MA-E/12", "MA-E"],
    ["MA-E/13", "MA-E"],
    ["PH/12", "PH"],
  ]);

  it("counts an exam right only in a course of its subject that one of its teachers teaches", () => {
    const sitters = new Map([...enrollments].filter(([student]) => student <= 502));

    const scoreIn = (courseId: string) =>
      Metrics.scoreExams(
        truth,
        [{ ...exam, courseId }],
        new Map([...sitters].map(([student]) => [student, new Set([courseId])])),
        teachers,
        subjects,
      ).exams;

    assert.deepStrictEqual(
      [scoreIn("MA-E/12"), scoreIn("MA-E/13"), scoreIn("PH/12")],
      [Metrics.fraction(1, 1), Metrics.fraction(0, 1), Metrics.fraction(0, 1)],
    );
  });

  it.each([
    {
      name: "to students of the course who don't sit it",
      ours: [exam],
      students: { recall: Metrics.fraction(2, 2), precision: Metrics.fraction(2, 3) },
    },
    {
      name: "twice",
      ours: [exam, { ...exam, id: "exam-2", start: 2 }],
      students: { recall: Metrics.fraction(2, 2), precision: Metrics.fraction(2, 6) },
    },
  ])("counts an exam shown $name", ({ ours, students }) => {
    assert.deepStrictEqual(Metrics.scoreExams(truth, ours, enrollments, teachers, subjects), {
      exams: Metrics.fraction(0, 1),
      students,
    });
  });
});

describe("Metrics.courseIdsKept", () => {
  it("counts an entry whose lesson moved to another course", () => {
    const truth = [entry([1]), entry([2])];
    const before = [lesson("a", [1]), lesson("b", [2])];
    const after = [lesson("a", [1]), lesson("b", [2], { courseId: "MA/13" })];

    assert.deepStrictEqual(
      Metrics.courseIdsKept(truth, Metrics.byEntry(before), Metrics.byEntry(after)),
      Metrics.fraction(1, 2),
    );
  });
});

describe("Metrics.scoreCourses", () => {
  const entries = [
    { date: day, ids: [1] },
    { date: day, ids: [2] },
  ];

  it.each([
    { name: "one course", same: true, courses: ["MA/12", "MA/12"], right: 1 },
    { name: "one course split in two", same: true, courses: ["MA/12", "MA/13"], right: 0 },
    { name: "two courses", same: false, courses: ["MA/12", "MA/13"], right: 1 },
    { name: "two courses merged", same: false, courses: ["MA/12", "MA/12"], right: 0 },
  ])("scores $name", ({ same, courses, right }) => {
    const ours = courses.map((courseId, index) => lesson(`l${index}`, [index + 1], { courseId }));

    assert.deepStrictEqual(
      Metrics.scoreCourses([{ id: "case", same, entries }], Metrics.byEntry(ours)).score,
      Metrics.fraction(right, 1),
    );
  });
});

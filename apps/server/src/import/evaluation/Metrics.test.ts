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

    assert.deepStrictEqual(Metrics.scoreChanges(changes, labels, ours), {
      score: Metrics.fraction(right, 2),
      passing,
    });
  });
});

describe("Metrics.scoreExams", () => {
  it("counts an exam shown to students of the course who don't sit it", () => {
    const enrollments = new Map([
      [501, new Set(["MA-E/12"])],
      [502, new Set(["MA-E/12"])],
      [503, new Set(["MA-E/12"])],
      [504, new Set(["DE/12"])],
    ]);

    const truth = [{ id: 901, date: day, start: 0, end: 1, students: [501, 502] }];
    const ours = [{ courseId: "MA-E/12", date: day, start: 0, end: 1, examIds: [901] }];

    assert.deepStrictEqual(Metrics.scoreExams(truth, ours, enrollments), {
      exams: Metrics.fraction(0, 1),
      students: { recall: Metrics.fraction(2, 2), precision: Metrics.fraction(2, 3) },
    });
  });
});

describe("Metrics.courseChurn", () => {
  it("counts an entry whose lesson moved to another course", () => {
    const truth = [entry([1]), entry([2])];
    const before = [lesson("a", [1]), lesson("b", [2])];
    const after = [lesson("a", [1]), lesson("b", [2], { courseId: "MA/13" })];

    assert.deepStrictEqual(Metrics.courseChurn(truth, before, after), Metrics.fraction(1, 2));
  });
});

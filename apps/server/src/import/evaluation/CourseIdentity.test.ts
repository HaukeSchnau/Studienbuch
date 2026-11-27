import { assert, describe, it } from "@effect/vitest";
import type { Lesson } from "@stu/core";
import { CourseIdentity } from "./CourseIdentity.ts";
import { Metrics } from "./Metrics.ts";

const monday = "2026-11-02";
const thursday = "2026-11-05";
const nextMonday = "2026-11-09";

const entry = (
  date: string,
  id: number,
  subject = "MA",
  status: Lesson.Status = "Regular",
): Metrics.TruthEntry => ({
  date,
  ids: [id],
  start: 0,
  end: 1,
  status,
  teachers: [],
  rooms: [],
  previousTeachers: [],
  previousRooms: [],
  subjects: [subject],
  classes: ["12"],
});

/** A lesson of `courseId` that claims the entries. */
const lesson = (courseId: string, ...entries: ReadonlyArray<Metrics.TruthEntry>) => ({
  id: `${courseId} ${entries.map(({ ids }) => ids.join("+")).join(" ")}`,
  courseId,
  date: entries[0]?.date ?? monday,
  start: 0,
  end: 1,
  status: "Regular" as const,
  teachers: [],
  rooms: [],
  previousTeachers: [],
  previousRooms: [],
  kind: undefined,
  entries: entries.map(({ date, ids }) => ({ date, ids })),
});

const measure = (
  attendance: Partial<Record<string, ReadonlyArray<Metrics.TruthEntry>>>,
  lessons: ReadonlyArray<Metrics.Lesson>,
  labels: ReadonlyArray<Metrics.LabelledCourse> = [],
  term = "winter",
) =>
  CourseIdentity.measure({
    term,
    attendance: Object.entries(attendance).map(([student, entries]) => ({
      student,
      entries: entries ?? [],
    })),
    index: Metrics.byEntry(lessons),
    labels,
    weekOf: (date) => (date < nextMonday ? "2026-W45" : "2026-W46"),
  });

const counts = (realCourses: number, split: number, ourCourses: number, merged: number) => ({
  realCourses,
  split,
  ourCourses,
  merged,
});

const e1 = entry(monday, 1);
const e2 = entry(thursday, 2);
const e3 = entry(nextMonday, 3);

describe("CourseIdentity.measure", () => {
  it.each([
    {
      // S3 leaves after the first opening week. Two exact rosters would make one course a merge.
      name: "a course whose roster changes between the opening weeks is one",
      attendance: { S1: [e1, e3], S2: [e1, e3], S3: [e1] },
      lessons: [lesson("ma", e1), lesson("ma", e3)],
      total: counts(1, 0, 1, 0),
      looks: [],
    },
    {
      name: "a group within a larger one, as a Kopplung shows it, is a course of its own",
      attendance: { S1: [e1, e2], S2: [e1, e2], S3: [e1], S4: [e1] },
      lessons: [lesson("ma", e1), lesson("ma", e2)],
      total: counts(2, 0, 1, 1),
      looks: ["merged MA nested"],
    },
    {
      // A roster change between the opening weeks would join them.
      name: "most of a course's students in a group of their own the same week",
      attendance: { S1: [e1, e2], S2: [e1, e2], S3: [e1, e2], S4: [e1] },
      lessons: [lesson("ma", e1), lesson("ma", e2)],
      total: counts(2, 0, 1, 1),
      looks: ["merged MA nested"],
    },
    {
      // Each shares most students with next Monday's roster, which may join only one of them.
      name: "two groups the same week that each share most students with a group next week",
      attendance: {
        S1: [e1, e2, e3],
        S2: [e1, e2, e3],
        S3: [e1, e2, e3],
        S4: [e1, e3],
        S5: [e2, e3],
      },
      lessons: [lesson("ma", e1), lesson("ma", e2), lesson("ma", e3)],
      total: counts(2, 0, 1, 1),
      looks: ["merged MA nested"],
    },
    {
      name: "parallel groups in one of our courses",
      attendance: { S1: [e1], S2: [e1], S3: [e2], S4: [e2] },
      lessons: [lesson("ma", e1), lesson("ma", e2)],
      total: counts(2, 0, 1, 1),
      looks: ["merged MA disjoint"],
    },
    {
      name: "groups that share a student, in one of our courses",
      attendance: { S1: [e1], S2: [e1], S3: [e1, e2], S4: [e2], S5: [e2] },
      lessons: [lesson("ma", e1), lesson("ma", e2)],
      total: counts(2, 0, 1, 1),
      looks: ["merged MA overlapping"],
    },
    {
      name: "an entry in two of our courses",
      attendance: { S1: [e1], S2: [e1] },
      lessons: [lesson("ma-a", e1), lesson("ma-b", e1)],
      total: counts(1, 1, 2, 0),
      looks: ["split MA one entry"],
    },
    {
      name: "a course's entries spread over two of ours",
      attendance: { S1: [e1, e2], S2: [e1, e2] },
      lessons: [lesson("ma-a", e1), lesson("ma-b", e2)],
      total: counts(1, 1, 2, 0),
      looks: ["split MA spread"],
    },
    {
      name: "an added entry and one without a subject, which are no course's",
      attendance: { S1: [entry(monday, 1, "MA", "Added"), { ...e3, subjects: [] }, e2] },
      lessons: [lesson("ma-a", e1), lesson("ma-b", e2), lesson("ma-c", e3)],
      total: counts(1, 0, 1, 0),
      looks: [],
    },
    {
      name: "an entry none of our lessons covers",
      attendance: { S1: [e1, e2] },
      lessons: [lesson("ma", e1)],
      total: counts(1, 0, 1, 0),
      looks: [],
    },
  ])("$name", ({ attendance, lessons, total, looks }) => {
    const measured = measure(attendance, lessons);

    assert.deepStrictEqual(measured.total, total);

    assert.deepStrictEqual(
      measured.cases.map(({ kind, subject, looksLike }) => `${kind} ${subject} ${looksLike}`),
      looks,
    );
  });

  it("counts a merge of two subjects in each", () => {
    const ph = entry(thursday, 2, "PH");
    const measured = measure({ S1: [e1, ph] }, [lesson("ma", e1), lesson("ma", ph)]);

    assert.deepStrictEqual(measured.total, counts(2, 0, 1, 1));

    assert.deepStrictEqual(Object.fromEntries(measured.subjects), {
      MA: counts(1, 0, 1, 1),
      PH: counts(1, 0, 1, 1),
    });

    assert.deepStrictEqual(
      measured.cases.map(({ subject, looksLike }) => `${subject} ${looksLike}`),
      ["MA+PH overlapping"],
    );
  });

  // Without its label, each row has no error.
  it.each([
    {
      // Two simultaneous rows of one course, one group each.
      name: "joins two rosters",
      attendance: { S1: [e1], S2: [entry(monday, 4)] },
      lessons: [lesson("ma-a", e1), lesson("ma-b", entry(monday, 4))],
      label: { id: "one", same: true, entries: [e1, entry(monday, 4)] },
      total: counts(1, 1, 2, 0),
    },
    {
      // Nothing says which course next Monday's entry is in, so it isn't counted.
      name: "splits one roster's courses",
      attendance: { S1: [e1, e2, e3] },
      lessons: [lesson("ma", e1), lesson("ma", e2), lesson("ma", e3)],
      label: { id: "two", same: false, entries: [e1, e2] },
      total: counts(2, 0, 1, 1),
    },
    {
      name: "keeps apart two rosters a roster change would join",
      attendance: { S1: [e1, e3], S2: [e1, e3], S3: [e1] },
      lessons: [lesson("ma", e1), lesson("ma", e3)],
      label: { id: "two", same: false, entries: [e1, e3] },
      total: counts(2, 0, 1, 1),
    },
  ])("a label $name", ({ attendance, lessons, label, total }) => {
    assert.deepStrictEqual(measure(attendance, lessons, [label]).total, total);
  });

  // A label joins Thursday's entry to next Monday's, and another tells it apart from this Monday's,
  // which shares next Monday's roster or most of it.
  it.each([
    {
      name: "a roster change",
      attendance: { S1: [e1, e3], S2: [e1, e3], S3: [e1], S4: [e2] },
      labels: [
        { id: "two", same: false, entries: [e1, e2] },
        { id: "one", same: true, entries: [e2, e3] },
      ],
    },
    {
      name: "one roster",
      attendance: { S1: [e1, e3], S2: [e2] },
      labels: [
        { id: "two", same: false, entries: [e1, e2] },
        { id: "one", same: true, entries: [e2, e3] },
      ],
    },
  ])(
    "keeps two entries a label tells apart in two courses, despite $name",
    ({ attendance, labels }) => {
      assert.deepStrictEqual(
        measure(attendance, [lesson("ma", e1), lesson("ma", e2), lesson("ma", e3)], labels).total,
        counts(2, 0, 1, 1),
      );
    },
  );
});

describe("CourseIdentity.combine", () => {
  it("adds up terms and keeps each subject's worst cases, most pieces first", () => {
    const twoPieces = measure({ S1: [e1] }, [lesson("a", e1), lesson("b", e1)], [], "summer");

    const threePieces = measure(
      { S1: [e1] },
      [lesson("a", e1), lesson("b", e1), lesson("c", e1)],
      [],
      "winter",
    );

    const { counts: total, cases } = CourseIdentity.combine([twoPieces, threePieces], 1);

    assert.deepStrictEqual(total, { ...counts(2, 2, 5, 0), subjects: { MA: counts(2, 2, 5, 0) } });

    assert.deepStrictEqual(
      cases.map(({ term, ourCourses }) => `${term} ${ourCourses.length}`),
      ["winter 3"],
    );
  });
});

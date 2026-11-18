import { assert, describe, it } from "@effect/vitest";
import {
  CivilTime,
  Closure,
  Course,
  CourseOffering,
  Lesson,
  SchoolClass,
  SchoolYear,
  Term,
} from "@stu/core";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import { NamedSchoolTesting } from "./corpus/NamedSchoolTesting.ts";
import { Policy } from "./corpus/Policy.ts";
import { Pseudonymizer } from "./corpus/Pseudonymizer.ts";
import { TinySchool } from "./evaluation/TinySchool.ts";
import { ImportIds } from "./ImportIds.ts";
import { ImportTesting } from "./ImportTesting.ts";
import { Projection } from "./Projection.ts";
import { SchoolImport } from "./SchoolImport.ts";
import { RecordedWebUntis } from "../infra/webuntis/RecordedWebUntis.ts";

const { profile } = TinySchool;
const { list, object, planted } = NamedSchoolTesting;
const toJson = Schema.decodeUnknownEffect(Schema.Json);
const decodeLesson = Schema.decodeUnknownEffect(Lesson.Row.codec);
const decodeClosure = Schema.decodeUnknownEffect(Closure.Row.codec);
const decodeOffering = Schema.decodeUnknownEffect(CourseOffering.Row.codec);

const project = (
  result: SchoolImport.ImportResult,
  previous: SchoolImport.ImportResult = SchoolImport.empty,
  pending: ReadonlyArray<Projection.Candidate> = [],
) => Projection.project({ profile, previous, result, pending, today: ImportTesting.today });

const year = SchoolYear.Id.make("2026");
const term = Term.Id.make("2026-1");
const ofClass = (name: string) => SchoolClass.Id.make(`2026-${name}`);

/** A lesson at `hour` o'clock and the WebUntis entries its link names. */
const lesson = (
  id: string,
  course: string,
  date: string,
  hour: number,
  ids: ReadonlyArray<number>,
  change?: SchoolImport.ImportedLesson["change"],
) => ({
  lesson: {
    id,
    courseId: Course.Id.make(course),
    date,
    start: hour * 3_600_000,
    end: (hour + 1) * 3_600_000,
    teacherIds: [`teacher-${course}`],
    roomIds: [`room-${course}`],
    status: change === undefined ? ("Regular" as const) : ("Changed" as const),
    change,
  },
  link: { id, refs: [SchoolImport.ProviderRef.cases.Entry.make({ date, ids })] },
});

type Lesson = ReturnType<typeof lesson>;

const offering = (
  course: string,
  gradeLevels: ReadonlyArray<number>,
  classes: ReadonlyArray<string>,
) => ({
  id: CourseOffering.idFor(Course.Id.make(course), term),
  courseId: Course.Id.make(course),
  termId: term,
  gradeLevels,
  classIds: classes.map(ofClass),
});

/** Grade 11's and grade 10's mathematics, with a teacher and a room each. */
const school: SchoolImport.ImportResult = {
  ...SchoolImport.empty,
  schoolYears: [{ id: year, name: "2026/2027", start: "2026-08-13", end: "2027-07-07" }],
  terms: [
    { id: term, schoolYearId: year, name: "1. Halbjahr", start: "2026-08-01", end: "2027-01-31" },
  ],
  classes: [
    { id: ofClass("11.1"), schoolYearId: year, name: "11.1", gradeLevel: 11 },
    { id: ofClass("10.1"), schoolYearId: year, name: "10.1", gradeLevel: 10 },
  ],
  courses: [
    { id: Course.Id.make("ma-11"), name: "MA" },
    { id: Course.Id.make("ma-10"), name: "MA" },
  ],
  offerings: [offering("ma-11", [11], ["11.1"]), offering("ma-10", [10], ["10.1"])],
  teachers: [
    { id: "teacher-ma-11", shortName: "LA" },
    { id: "teacher-ma-10", shortName: "LZ" },
  ],
  rooms: [
    { id: "room-ma-11", name: "R101" },
    { id: "room-ma-10", name: "R110" },
  ],
};

const withLessons = (
  base: SchoolImport.ImportResult,
  lessons: ReadonlyArray<Lesson>,
  more: Partial<SchoolImport.ImportResult> = {},
): SchoolImport.ImportResult => ({
  ...base,
  lessons: lessons.map((each) => each.lesson),
  links: lessons.map((each) => each.link),
  ...more,
});

const thisWeek = { rows: "lessons" as const, start: "2026-11-02", end: "2026-11-08" };

/** The published entry of a lesson, as the publish hands it to `Removals`. */
const published = (each: Lesson) => {
  const { id, change, ...row } = each.lesson;

  return Effect.map(decodeLesson(change === undefined ? row : { ...row, change }), (decoded) => ({
    id,
    row: decoded,
  }));
};

const candidate = (each: Lesson): Projection.Candidate => ({
  rows: "lessons",
  id: each.lesson.id,
  start: each.lesson.date,
  end: each.lesson.date,
});

/** Every key, string and number in `value`. */
const leaves = (value: Schema.Json): ReadonlyArray<string | number> => {
  if (Predicate.isString(value) || Predicate.isNumber(value)) return [value];

  if (Array.isArray(value)) return value.flatMap(leaves);

  return Policy.isObject(value)
    ? Object.entries(value).flatMap(([key, inner]) => [key, ...leaves(inner)])
    : [];
};

/** Every key, string and number of the rows a projection publishes. */
const rowsOf = (result: SchoolImport.ImportResult) =>
  Effect.map(toJson(project(result).data), leaves);

describe("Projection", () => {
  it("lets in only the profile's grade levels, with the teachers and rooms their lessons name", () => {
    const { data } = project(
      withLessons(
        {
          ...school,
          // Offered to grades 10 and 11, it enters for grade 11 alone.
          offerings: [...school.offerings, offering("ma-both", [10, 11], [])],
          courses: [...school.courses, { id: Course.Id.make("ma-both"), name: "MA" }],
        },
        [
          lesson("eleven", "ma-11", "2026-11-03", 8, [1]),
          lesson("ten", "ma-10", "2026-11-03", 8, [2]),
        ],
      ),
    );

    assert.deepStrictEqual(
      {
        classes: Object.keys(data.classes),
        courses: Object.keys(data.courses).sort(),
        offerings: Object.values(data.offerings).map(({ courseId, gradeLevels }) => ({
          courseId,
          gradeLevels,
        })),
        teachers: Object.keys(data.teachers),
        rooms: Object.keys(data.rooms),
        lessons: Object.keys(data.lessons),
      },
      {
        classes: [ofClass("11.1")],
        courses: ["ma-11", "ma-both"],
        offerings: [
          { courseId: Course.Id.make("ma-11"), gradeLevels: [11] },
          { courseId: Course.Id.make("ma-both"), gradeLevels: [11] },
        ],
        teachers: ["teacher-ma-11"],
        rooms: ["room-ma-11"],
        lessons: ["ma-11"],
      },
    );
  });

  // Enrollment.set refuses a course whose offering isn't for the chooser's grade level and class.
  it.effect("keeps a choice valid when a later result offers the course to fewer classes", () =>
    Effect.gen(function* () {
      const first = { ...school, offerings: [offering("ma-11", [11], ["11.1"])] };
      const narrower = { ...school, offerings: [offering("ma-11", [11], ["11.2"])] };
      const previous = SchoolImport.apply(SchoolImport.empty, first);
      const { data } = project(narrower, previous);
      const chooser = { termId: term, gradeLevel: 11, classId: ofClass("11.1") };

      const rows = yield* Effect.forEach(Object.values(data.offerings), (row) =>
        decodeOffering(row),
      );

      assert.isTrue(rows.some((row) => CourseOffering.isFor(row, chooser)));
    }),
  );

  it.each([
    { text: "Vertretung", shown: "Vertretung" },
    { text: " vertretung ", shown: "Vertretung" },
    { text: "Raumänderung".normalize("NFD"), shown: "Raumänderung" },
    { text: "Vertretung für Wiebke", shown: undefined },
    { text: "Wiebke", shown: undefined },
  ])("lets '$text' show as $shown", ({ text, shown }) => {
    const changed = lesson("changed", "ma-11", "2026-11-03", 8, [1], {
      kind: "Other",
      previousTeacherIds: [],
      previousRoomIds: [],
      text,
    });

    const { data } = project(withLessons(school, [changed]));

    assert.strictEqual(data.lessons["ma-11"]?.changed?.change?.text, shown);
  });

  it("refuses rows their tables refuse and publishes the rest", () => {
    const { data, rejected } = project(
      withLessons(school, [lesson("impossible", "ma-11", "2026-02-30", 8, [1])], {
        closures: [
          { id: "backwards", name: "Rückwärts", start: "2026-12-23", end: "2026-12-21" },
          { id: "winter", name: "Weihnachtsferien", start: "2026-12-21", end: "2027-01-02" },
        ],
        weeks: [
          { week: "2026-W99", label: "A" },
          { week: "2026-W47", label: "B" },
        ],
      }),
    );

    assert.deepStrictEqual(
      {
        rejected,
        closures: Object.keys(data.closures),
        weeks: Object.keys(data.weekLabels),
        lessons: Object.keys(data.lessons["ma-11"] ?? {}),
      },
      {
        rejected: [
          { table: "Closure", id: "backwards" },
          { table: "WeekLabel", id: "2026-W99" },
          { table: "Lesson", id: "impossible" },
        ],
        closures: ["winter"],
        weeks: ["2026-W47"],
        lessons: [],
      },
    );
  });

  describe("removals", () => {
    const eight = lesson("eight", "ma-11", "2026-11-03", 8, [11]);

    const ten = (ids: ReadonlyArray<number>, course = "ma-11") =>
      lesson(`ten-${course}`, course, "2026-11-03", 10, ids);

    const one = lesson("one", "ma-11", "2026-11-03", 13, [11]);
    const lastWeek = lesson("last-week", "ma-11", "2026-10-27", 8, [5]);
    const refused = lesson("refused", "ma-11", "2026-11-03", 13, [12]);
    const noTeacher = { ...refused, lesson: { ...refused.lesson, teacherIds: [""] } };

    it.effect.each([
      {
        name: "a lesson whose entry moved to another slot goes at once",
        previous: [eight],
        result: [ten([11])],
        removed: true,
        waiting: [],
      },
      {
        name: "a lesson WebUntis renumbered waits for the next snapshot",
        previous: [eight],
        result: [ten([12])],
        removed: false,
        waiting: ["eight"],
      },
      {
        name: "a lesson two slots claim waits, as when the views of a joint entry disagree",
        previous: [eight],
        result: [ten([11]), one],
        removed: false,
        waiting: ["eight"],
      },
      {
        name: "a lesson another course claims waits, because only the nightly run moves courses",
        previous: [eight],
        result: [ten([11], "ph-11")],
        removed: false,
        waiting: ["eight"],
      },
      {
        name: "a joint lesson waits in each course when its views put it in different slots",
        previous: [eight],
        result: [ten([11]), lesson("one-ph", "ph-11", "2026-11-03", 13, [11])],
        removed: false,
        waiting: ["eight"],
      },
      {
        name: "a lesson whose new slot the publish refuses waits",
        previous: [eight],
        result: [lesson("ten-on-a-day-that-doesnt-exist", "ma-11", "2026-11-31", 10, [11])],
        removed: false,
        waiting: ["eight"],
      },
      {
        name: "a lesson missing on a day with a row the publish refuses stays",
        previous: [eight],
        result: [noTeacher],
        removed: false,
        waiting: [],
      },
      {
        name: "a lesson missing on a day with an unattributed entry stays",
        previous: [eight],
        result: [],
        unattributed: [{ date: "2026-11-03", ids: [99] }],
        removed: false,
        waiting: [],
      },
      {
        name: "a lesson missing on a day the run didn't cover stays",
        previous: [eight],
        result: [],
        covers: [],
        removed: false,
        waiting: [],
      },
      {
        name: "a lesson missing from two snapshots goes",
        pending: [candidate(eight)],
        result: [],
        removed: true,
        waiting: [],
      },
      {
        name: "a lesson back in between never goes",
        pending: [candidate(eight)],
        result: [eight],
        removed: false,
        waiting: [],
      },
      {
        name: "a candidate on a day with a row the publish refuses keeps waiting",
        pending: [candidate(eight)],
        result: [noTeacher],
        removed: false,
        waiting: ["eight"],
      },
      {
        name: "a candidate the run didn't cover keeps waiting",
        pending: [candidate(eight)],
        result: [],
        covers: [],
        removed: false,
        waiting: ["eight"],
      },
    ])("$name", (scenario) =>
      Effect.gen(function* () {
        const { previous = [], pending = [], covers = [thisWeek], unattributed = [] } = scenario;

        const projection = project(
          withLessons(school, scenario.result, { covers, unattributed }),
          withLessons(school, previous),
          pending,
        );

        assert.deepStrictEqual(
          {
            removed: projection.removals.lesson(yield* published(eight)),
            waiting: projection.pending.map(({ id }) => id),
          },
          { removed: scenario.removed, waiting: scenario.waiting },
        );
      }),
    );

    it.effect("drops a candidate whose day is past, which stays as it was", () =>
      Effect.gen(function* () {
        const { removals, pending } = project(
          withLessons(school, [], { covers: [{ ...thisWeek, start: "2026-10-26" }] }),
          withLessons(school, [lastWeek]),
          [candidate(lastWeek)],
        );

        assert.deepStrictEqual(
          { removed: removals.lesson(yield* published(lastWeek)), pending },
          { removed: false, pending: [] },
        );
      }),
    );

    const holidays = { rows: "closures" as const, start: "2026-08-13", end: "2027-07-07" };

    const autumn = (end: string) => ({
      id: "autumn",
      name: "Herbstferien",
      start: "2026-11-02",
      end,
    });

    const autumnRange = { start: "2026-11-02", end: "2026-11-06" };
    const autumnDates = [autumnRange];

    it.effect.each([
      {
        name: "a shortened closure may lose the dates it no longer names",
        result: [autumn("2026-11-04")],
        covers: [holidays],
        loses: autumnDates,
        waiting: [],
      },
      {
        name: "a closure WebUntis stopped listing waits for the next snapshot",
        result: [],
        covers: [holidays],
        loses: [],
        waiting: ["autumn"],
      },
      {
        name: "a closure missing from two snapshots goes",
        result: [],
        pending: [{ rows: "closures" as const, id: "autumn", ...autumnRange }],
        covers: [holidays],
        loses: autumnDates,
        waiting: [],
      },
      {
        // The October dates stayed published from before, and neither snapshot was about them.
        name: "a closure missing from two snapshots loses only the dates both covered",
        published: [{ start: "2026-10-26", end: "2026-11-06" }],
        result: [],
        pending: [{ rows: "closures" as const, id: "autumn", ...autumnRange }],
        covers: [holidays],
        loses: autumnDates,
        waiting: [],
      },
      {
        name: "a closure WebUntis lists with its end before its start stays as it was",
        result: [autumn("2026-11-01")],
        covers: [holidays],
        loses: [],
        waiting: [],
      },
      {
        name: "a closure the holiday read covers only in part stays",
        result: [],
        covers: [{ ...holidays, start: "2026-11-03" }],
        loses: [],
        waiting: [],
      },
    ])("$name", (scenario) =>
      Effect.gen(function* () {
        const projection = project(
          { ...school, closures: scenario.result, covers: scenario.covers },
          { ...school, closures: [autumn("2026-11-06")] },
          scenario.pending ?? [],
        );

        const row = yield* decodeClosure({
          name: "Herbstferien",
          dates: scenario.published ?? autumnDates,
        });

        const lost = projection.removals.closureDates({ id: "autumn", row });

        assert.deepStrictEqual(
          {
            loses: lost.map(({ start, end }) => ({
              start: CivilTime.format(start),
              end: CivilTime.format(end),
            })),
            waiting: projection.pending.map(({ id }) => id),
          },
          { loses: scenario.loses, waiting: scenario.waiting },
        );
      }),
    );
  });

  describe("on the naive import's result", () => {
    const studentId = /\b50[1-8]\b/u;

    it.effect("leaves no student's name, id or token in any row", () =>
      Effect.gen(function* () {
        // A substitution text and a subject that name a student, beside the invented names
        // everywhere else.
        const named = planted(
          NamedSchoolTesting.corpus,
          RecordedWebUntis.paths.entries(10, "CLASS", 112),
          (body) => {
            const day = (date: string) =>
              object(list(body.days).find((each) => object(each).date === date));

            for (const entry of list(day("2026-11-06").gridEntries)) {
              object(entry).substitutionText = "Betreuung durch Wiebke Gänseblum";
            }

            for (const entry of list(day("2026-11-02").gridEntries)) {
              object(object(list(object(entry).position2)[0]).current).shortName =
                "Wiebke Gänseblum";
            }
          },
        );

        const raw = yield* ImportTesting.naive(named);
        const rows = yield* rowsOf(raw.result);

        for (const name of NamedSchoolTesting.studentNames) {
          const lower = name.toLocaleLowerCase("de");

          assert.isFalse(
            rows.some(
              (leaf) => Predicate.isString(leaf) && leaf.toLocaleLowerCase("de").includes(lower),
            ),
            name,
          );
        }

        assert.isFalse(
          rows.some((leaf) =>
            Predicate.isString(leaf) ? studentId.test(leaf) : leaf >= 501 && leaf <= 508,
          ),
        );

        // The same school through the pseudonymizer: its students' tokens and ids stay out too.
        const { corpus } = yield* Pseudonymizer.corpus(new Uint8Array(32).fill(7), named);

        const [directory] =
          corpus.reads.get(RecordedWebUntis.paths.filter(10, "STUDENT"))?.versions ?? [];

        const students = list(object(directory?.body).students).map((each) =>
          object(object(each).student),
        );

        const tokens = new Set(
          students.flatMap((each) => [each.id, each.shortName, each.longName]),
        );

        const pseudonymized = yield* ImportTesting.naive(corpus);

        assert.isNotEmpty(students);

        assert.deepStrictEqual(
          (yield* rowsOf(pseudonymized.result)).filter((leaf) => tokens.has(leaf)),
          [],
        );
      }),
    );

    it.effect("makes a joint lesson one row in each of its courses' spaces", () =>
      Effect.gen(function* () {
        const { result } = yield* ImportTesting.naive(TinySchool.corpus);
        const { data } = project(result);

        // `INF` on Wednesday of W45 is one entry for `11.1` and `12`.
        const joint = ["INF/11.1", "INF/12"].map((key) =>
          Object.values(data.lessons[ImportIds.course(profile.id, key)] ?? {})
            .filter(({ date }) => date === "2026-11-04")
            .map(({ start, teacherIds }) => ({ start, teacherIds })),
        );

        assert.deepStrictEqual(joint, [
          [{ start: 41_400_000, teacherIds: [ImportIds.teacher(profile.id, 206)] }],
          [{ start: 41_400_000, teacherIds: [ImportIds.teacher(profile.id, 206)] }],
        ]);
      }),
    );

    it.effect("gives the same rows whatever the order of reads and without a previous run", () =>
      Effect.gen(function* () {
        const first = yield* ImportTesting.naive(TinySchool.corpus);
        const state = SchoolImport.apply(SchoolImport.empty, first.result);
        const again = yield* ImportTesting.naive(TinySchool.corpus, { previous: state });
        const reversed = yield* ImportTesting.naive(TinySchool.corpus, { reversed: true });

        assert.isNotEmpty(Object.keys(project(first.result).data.lessons));
        assert.deepStrictEqual(project(reversed.result).data, project(again.result, state).data);
      }),
    );
  });
});

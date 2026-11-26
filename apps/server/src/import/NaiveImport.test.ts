import { assert, describe, it } from "@effect/vitest";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { SchoolYear } from "@stu/core";
import { RecordedWebUntis } from "../infra/webuntis/RecordedWebUntis.ts";
import { NamedSchoolTesting } from "./corpus/NamedSchoolTesting.ts";
import type { Policy } from "./corpus/Policy.ts";
import { TinySchool } from "./evaluation/TinySchool.ts";
import { ImportIds } from "./ImportIds.ts";
import { ImportTesting } from "./ImportTesting.ts";
import { SchoolImport } from "./SchoolImport.ts";

const { list, object, planted } = NamedSchoolTesting;
const school = TinySchool.profile.id;
const year = SchoolYear.Id.make("2026");
const course = (key: string) => ImportIds.course(school, key);
const entriesOf = (resource: number) => RecordedWebUntis.paths.entries(10, "CLASS", resource);
const classes = RecordedWebUntis.paths.filter(10, "CLASS");

/** The invented school with `11.1` gone from the class directory. */
const withoutClass111 = planted(TinySchool.corpus, classes, (body) => {
  body.classes = list(body.classes).filter((each) => object(object(each).class).id !== 111);
});

const thisWeek = { start: "2026-11-02", end: "2026-11-06" };
const nextWeek = { start: "2026-11-09", end: "2026-11-13" };

const laterWeeks = [
  { start: "2026-11-16", end: "2026-11-20" },
  { start: "2026-11-23", end: "2026-11-27" },
];

const lessonCovers = (result: SchoolImport.ImportResult) =>
  result.covers.filter(({ rows }) => rows === "lessons").map(({ start, end }) => ({ start, end }));

/** The day of an entries body, to change in place. */
const dayOf = (body: NamedSchoolTesting.Mutable, date: string) =>
  object(list(body.days).find((day) => object(day).date === date));

/** When Monday's `MA-E` group meets, 11:30. */
const maEStart = 41_400_000;

/**
 * The invented school with a second row of `MA-E` in `12` on Monday of W45, at the first group's
 * time under teacher `LB` in `R102`, or no teacher when `teacher` is false, and the first group's
 * row cancelled when `cancelled`.
 */
const withSecondMaE = (cancelled: boolean, teacher = true) =>
  planted(TinySchool.corpus, entriesOf(112), (body) => {
    const day = dayOf(body, "2026-11-02");
    const entries = list(day.gridEntries);
    const first = object(entries[0]);
    const second = object(structuredClone(first));

    second.ids = [9001];
    object(object(list(second.position1)[0]).current).shortName = "LB";
    object(object(list(second.position3)[0]).current).shortName = "R102";

    if (!teacher) second.position1 = null;

    if (cancelled) first.status = "CANCELLED";

    day.gridEntries = [...entries, second];
  });

describe("NaiveImport", () => {
  it.effect("covers the days of each week every class answered for", () =>
    Effect.gen(function* () {
      const { result, log } = yield* ImportTesting.naive(TinySchool.corpus);

      // Its answers leave out weekends, which therefore delete nothing.
      assert.deepStrictEqual(lessonCovers(result), [thisWeek, nextWeek, ...laterWeeks]);
      assert.isFalse(SchoolImport.deletes(result, "lessons", "2026-11-07"));
      assert.deepStrictEqual(log.notCaptured, []);
    }),
  );

  it.effect("doesn't cover a week whose answer names another class than the one asked for", () =>
    Effect.gen(function* () {
      const corpus = planted(TinySchool.corpus, entriesOf(111), (body) => {
        dayOf(body, "2026-11-03").resource = {
          id: 112,
          shortName: "12",
          longName: "12",
          displayName: "12",
        };
      });

      const { result } = yield* ImportTesting.naive(corpus);

      assert.deepStrictEqual(lessonCovers(result), [nextWeek, ...laterWeeks]);

      // The day's entries are another class's, so none of them became a lesson of `11.1`'s.
      assert.isFalse(
        result.lessons.some(
          ({ courseId, date }) => courseId === course("EN/11.1") && date === "2026-11-03",
        ),
      );
    }),
  );

  // The directory's name decides the course, so an answer that calls `11.1` by another name
  // neither files its lessons under that class nor counts as read.
  it.effect("doesn't cover a week whose answer gives the class another name", () =>
    Effect.gen(function* () {
      const corpus = planted(TinySchool.corpus, entriesOf(111), (body) => {
        object(dayOf(body, "2026-11-04").resource).shortName = "13";
      });

      const { result } = yield* ImportTesting.naive(corpus);

      assert.deepStrictEqual(lessonCovers(result), [nextWeek, ...laterWeeks]);

      assert.isFalse(
        result.lessons.some(
          ({ courseId, date }) => courseId === course("DE/13") && date === "2026-11-04",
        ),
      );
    }),
  );

  it.effect.each([
    {
      name: "makes parallel groups, two rows of a subject and class at once, a course each",
      cancelled: false,
      lessons: [
        { courseId: course("MA-E/12/LB"), teachers: [202], rooms: [302], entries: [[9001]] },
        { courseId: course("MA-E/12/LC"), teachers: [203], rooms: [303], entries: [[1104]] },
      ],
    },
    {
      name: "makes a cancelled lesson and its replacement in one slot one lesson",
      cancelled: true,
      lessons: [
        {
          courseId: course("MA-E/12"),
          teachers: [202, 203],
          rooms: [302, 303],
          entries: [[1104], [9001]],
        },
      ],
    },
    {
      name: "makes a row without a teacher next to a group's row in one slot one lesson",
      cancelled: false,
      teacher: false,
      lessons: [
        {
          courseId: course("MA-E/12"),
          teachers: [203],
          rooms: [302, 303],
          entries: [[1104], [9001]],
        },
      ],
    },
  ])("$name", ({ cancelled, teacher, lessons }) =>
    Effect.gen(function* () {
      const { result } = yield* ImportTesting.naive(withSecondMaE(cancelled, teacher));

      const byCourse = (a: { courseId: string }, b: { courseId: string }) =>
        a.courseId.localeCompare(b.courseId);

      assert.deepStrictEqual(
        result.lessons
          .filter(({ date, start }) => date === "2026-11-02" && start === maEStart)
          .map(({ id, courseId, teacherIds, roomIds }) => ({
            courseId,
            teacherIds,
            roomIds,
            entries: result.links
              .find((link) => link.id === id)
              ?.refs.map((ref) => (ref._tag === "Entry" ? ref.ids : [])),
          }))
          .toSorted(byCourse),
        lessons
          .map(({ courseId, teachers, rooms, entries }) => ({
            courseId,
            teacherIds: teachers.map((id) => ImportIds.teacher(school, id)).sort(),
            roomIds: rooms.map((id) => ImportIds.room(school, id)).sort(),
            entries,
          }))
          .toSorted(byCourse),
      );
    }),
  );

  // Only the nightly run creates courses, so only it decides that a family has parallel groups.
  it.effect.each([
    {
      name: "keeps parallel groups' courses in a daytime run whose reads show no parallel meeting",
      // Monday's first group is cancelled now, so no two groups meet as planned in the window.
      night: withSecondMaE(false),
      day: withSecondMaE(true),
      courses: ["MA-E/12/LB", "MA-E/12/LC"],
    },
    {
      name: "keeps a family's course in a daytime run that first shows its parallel groups",
      night: TinySchool.corpus,
      day: withSecondMaE(false),
      courses: ["MA-E/12"],
    },
  ])("$name", ({ night, day, courses }) =>
    Effect.gen(function* () {
      const nightly = yield* ImportTesting.naive(night);
      const previous = SchoolImport.apply(SchoolImport.empty, nightly.result);

      const { result } = yield* ImportTesting.naive(day, {
        previous,
        nightly: false,
        now: ImportTesting.noon,
      });

      assert.deepStrictEqual(
        {
          courses: Arr.dedupe(
            result.lessons
              .filter(({ date, start }) => date === "2026-11-02" && start === maEStart)
              .map(({ courseId }) => courseId),
          ).sort(),
          unattributed: result.unattributed.filter(({ date }) => date === "2026-11-02"),
        },
        { courses: courses.map(course).sort(), unattributed: [] },
      );
    }),
  );

  it.effect.each([
    {
      name: "makes a Kopplung's entry, which each class's view shows, one lesson of one course",
      shownBy112: true,
      subject: true,
      courses: {
        "INF/11.1+12": { classes: [111, 112], gradeLevels: [11, 12], lasting: false },
      },
    },
    {
      name: "reads and offers a Kopplung for each of its classes, whichever views show it",
      shownBy112: false,
      subject: true,
      courses: {
        "INF/11.1+12": { classes: [111, 112], gradeLevels: [11, 12], lasting: false },
      },
    },
    {
      name: "leaves an entry without a subject to the class whose view shows it",
      shownBy112: true,
      subject: false,
      courses: {
        "?/11.1": { classes: [111], gradeLevels: [11], lasting: true },
        "?/12": { classes: [112], gradeLevels: [12], lasting: false },
      },
    },
  ])("$name", ({ shownBy112, subject, courses }) =>
    Effect.gen(function* () {
      // As WebUntis shows the joint `INF` lesson: each class's view lists the other class only.
      const kopplung = [
        { view: 111, other: "12", shown: true },
        { view: 112, other: "11.1", shown: shownBy112 },
      ].reduce(
        (corpus, { view, other, shown }) =>
          planted(corpus, entriesOf(view), (body) => {
            const inf = object(
              list(dayOf(body, "2026-11-11").gridEntries).find((each) =>
                list(object(each).ids).includes(1212),
              ),
            );

            inf.position4 = list(inf.position4).filter(
              (each) => object(object(each).current).shortName === other,
            );

            if (!subject) inf.position2 = null;

            // In no week, so only the other class's view names this class.
            const isInf = (each: Policy.Json) =>
              object(object(list(object(each).position2)[0]).current).shortName === "INF";

            for (const day of list(body.days).map(object)) {
              if (!shown) day.gridEntries = list(day.gridEntries).filter((each) => !isInf(each));
            }
          }),
        TinySchool.corpus,
      );

      const { result } = yield* ImportTesting.naive(kopplung);
      const linksOf = (id: string) => result.links.find((link) => link.id === id)?.refs ?? [];

      // Per course: its lessons of that Wednesday by the entries they claim, the class views it
      // is read from, and who it is offered to. A grade-12 student has no class to name.
      assert.deepStrictEqual(
        Object.keys(courses).map((key) => {
          const id = course(key);

          return {
            lessons: result.lessons
              .filter(({ courseId, date }) => courseId === id && date === "2026-11-11")
              .map((lesson) =>
                linksOf(lesson.id).map((ref) => (ref._tag === "Entry" ? ref.ids : [])),
              ),
            classes: linksOf(id).map((ref) => (ref._tag === "Resource" ? ref.id : 0)),
            offerings: result.offerings
              .filter(({ courseId }) => courseId === id)
              .map(({ gradeLevels, classIds }) => ({ gradeLevels, classIds })),
          };
        }),
        Object.values(courses).map(({ classes, gradeLevels, lasting }) => ({
          lessons: [[[1212, 1213]]],
          classes,
          offerings: [
            { gradeLevels, classIds: lasting ? [ImportIds.schoolClass(year, "11.1")] : [] },
          ],
        })),
      );
    }),
  );

  it.effect("leaves an entry of a course it doesn't know out of a daytime run", () =>
    Effect.gen(function* () {
      const nightly = yield* ImportTesting.naive(TinySchool.corpus);
      const de = course("DE/11.1");
      const known = SchoolImport.apply(SchoolImport.empty, nightly.result);

      const { result } = yield* ImportTesting.naive(TinySchool.corpus, {
        previous: { ...known, courses: known.courses.filter(({ id }) => id !== de) },
        nightly: false,
        now: ImportTesting.noon,
      });

      const knownIds = new Set(known.courses.map(({ id }) => id));

      assert.deepStrictEqual(
        {
          lessons: result.lessons.filter(({ courseId }) => courseId === de).length,
          unknownCourses: result.courses.filter(({ id }) => !knownIds.has(id)).length,
          offerings: result.offerings.length,
          unattributed: result.unattributed.filter(({ date }) => date <= "2026-11-08"),
          // A lesson missing on Monday may be that entry, so Monday deletes none.
          deletesMonday: SchoolImport.deletes(result, "lessons", "2026-11-02"),
          deletesTuesday: SchoolImport.deletes(result, "lessons", "2026-11-03"),
        },
        {
          lessons: 0,
          unknownCourses: 0,
          offerings: 0,
          unattributed: [
            { date: "2026-11-02", ids: [1100] },
            { date: "2026-11-04", ids: [1114] },
          ],
          deletesMonday: false,
          deletesTuesday: true,
        },
      );
    }),
  );

  it.effect("reads only the classes of the profile's grade levels", () =>
    Effect.gen(function* () {
      const corpus = planted(TinySchool.corpus, classes, (body) => {
        const display = { id: 108, shortName: "8.2", longName: "8.2", displayName: "8.2" };

        body.classes = [
          ...list(body.classes),
          { class: display, classTeacher1: null, classTeacher2: null, department: null },
        ];
      });

      const { result, log } = yield* ImportTesting.naive(corpus);

      // Its view isn't in the recording, so a read of it would fail and leave the week uncovered.
      assert.deepStrictEqual(log.notCaptured, []);
      assert.deepStrictEqual(lessonCovers(result)[0], thisWeek);
      assert.isFalse(result.classes.some(({ name }) => name === "8.2"));
    }),
  );

  it.effect("names a teacher by the long name where it says more than the short one", () =>
    Effect.gen(function* () {
      // LB's long name repeats the short one, LC's is blank, LD's has spaces around it.
      const longNames = new Map<unknown, string>([
        ["LB", "LB"],
        ["LC", " "],
        ["LD", " Dornhecke "],
      ]);

      const corpus = planted(
        TinySchool.corpus,
        RecordedWebUntis.paths.filter(10, "TEACHER"),
        (body) => {
          for (const each of list(body.teachers)) {
            const teacher = object(object(each).teacher);

            teacher.longName = longNames.get(teacher.shortName) ?? teacher.longName ?? null;
          }
        },
      );

      const { result } = yield* ImportTesting.naive(corpus);

      assert.deepStrictEqual(
        result.teachers
          .map(({ shortName, displayName }) => `${shortName}: ${displayName ?? "none"}`)
          .slice(0, 4),
        ["LA: Lehrkraft A", "LB: none", "LC: none", "LD: Dornhecke"],
      );
    }),
  );

  it.effect("keeps a class's lessons when the directory drops the class", () =>
    Effect.gen(function* () {
      const before = yield* ImportTesting.naive(TinySchool.corpus);
      const state = SchoolImport.apply(SchoolImport.empty, before.result);
      const { result } = yield* ImportTesting.naive(withoutClass111, { previous: state });

      const ofClass = (lessons: ReadonlyArray<SchoolImport.ImportedLesson>) =>
        lessons.filter(({ courseId }) => courseId === course("DE/11.1")).length;

      // It is still read, and with no name to attribute them by, its entries go unattributed,
      // so its days delete no lesson, Tuesday's included, when it has none.
      assert.deepStrictEqual(
        {
          unattributed: result.unattributed.some(({ ids }) => ids.includes(1100)),
          kept: ofClass(SchoolImport.apply(state, result).lessons),
          deletesItsEmptyTuesday: SchoolImport.deletes(result, "lessons", "2026-11-03"),
        },
        { unattributed: true, kept: ofClass(state.lessons), deletesItsEmptyTuesday: false },
      );
    }),
  );

  it.effect("doesn't read a class it knows only from another school year", () =>
    Effect.gen(function* () {
      const before = yield* ImportTesting.naive(TinySchool.corpus);
      const state = SchoolImport.apply(SchoolImport.empty, before.result);
      const lastYear = SchoolYear.Id.make("2025");

      const { result } = yield* ImportTesting.naive(withoutClass111, {
        previous: {
          ...state,
          terms: state.terms.map((term) => ({ ...term, schoolYearId: lastYear })),
          classes: state.classes.map((each) => ({ ...each, schoolYearId: lastYear })),
        },
      });

      assert.deepStrictEqual(result.unattributed, []);
    }),
  );

  it.effect("covers no closure when the holidays are another school year's", () =>
    Effect.gen(function* () {
      const corpus = planted(TinySchool.corpus, RecordedWebUntis.paths.appData, (body) => {
        object(body.currentSchoolYear).id = 11;
      });

      const ofYear = yield* ImportTesting.naive(TinySchool.corpus);
      const other = yield* ImportTesting.naive(corpus);

      const closureCovers = (result: SchoolImport.ImportResult) =>
        result.covers.filter(({ rows }) => rows === "closures").length;

      assert.deepStrictEqual([closureCovers(ofYear.result), closureCovers(other.result)], [1, 0]);
    }),
  );
});

import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { SchoolYear } from "@stu/core";
import { RecordedWebUntis } from "../infra/webuntis/RecordedWebUntis.ts";
import { NamedSchoolTesting } from "./corpus/NamedSchoolTesting.ts";
import { TinySchool } from "./evaluation/TinySchool.ts";
import { ImportIds } from "./ImportIds.ts";
import { ImportTesting } from "./ImportTesting.ts";
import { SchoolImport } from "./SchoolImport.ts";

const { list, object, planted } = NamedSchoolTesting;
const school = TinySchool.profile.id;
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

  it.effect(
    "makes two rows of one course in one slot one lesson with both teachers and rooms",
    () =>
      Effect.gen(function* () {
        const corpus = planted(TinySchool.corpus, entriesOf(112), (body) => {
          const day = dayOf(body, "2026-11-02");
          const entries = list(day.gridEntries);
          const maE = object(structuredClone(entries[0]));
          const teacher = object(list(maE.position1)[0]);
          const room = object(list(maE.position3)[0]);

          maE.ids = [9001];
          object(teacher.current).shortName = "LB";
          object(room.current).shortName = "R102";
          day.gridEntries = [...entries, maE];
        });

        const { result } = yield* ImportTesting.naive(corpus);

        const lessons = result.lessons.filter(
          ({ courseId, date }) => courseId === course("MA-E/12") && date === "2026-11-02",
        );

        assert.deepStrictEqual(
          lessons.map(({ teacherIds, roomIds }) => ({ teacherIds, roomIds })),
          [
            {
              teacherIds: [ImportIds.teacher(school, 202), ImportIds.teacher(school, 203)].sort(),
              roomIds: [ImportIds.room(school, 302), ImportIds.room(school, 303)].sort(),
            },
          ],
        );

        assert.deepStrictEqual(
          result.links
            .find(({ id }) => id === lessons[0]?.id)
            ?.refs.map((ref) => (ref._tag === "Entry" ? ref.ids : [])),
          [[1104], [9001]],
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

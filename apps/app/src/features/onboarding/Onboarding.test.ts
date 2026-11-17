import {
  Course,
  type CourseOffering,
  Enrollment,
  Notebook,
  SchoolClass,
  SchoolYear,
  Subject,
  Term,
} from "@stu/core";
import { assert, it } from "@effect/vitest";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import { Onboarding } from "./Onboarding.ts";

const term = Term.Id.make("winter");

const cls = (id: string, name: string, gradeLevel: number) => ({
  id: SchoolClass.Id.make(id),
  schoolYearId: SchoolYear.Id.make("2026"),
  name,
  gradeLevel,
});

const offering = (
  course: string,
  extra: Partial<
    Pick<CourseOffering.Row, "classIds" | "groupKey" | "choiceRequired" | "gradeLevels">
  > = {},
): CourseOffering.Row => ({
  courseId: Course.Id.make(course),
  termId: term,
  gradeLevels: [9],
  classIds: [],
  ...extra,
});

const choices: Onboarding.TermChoices = {
  id: term,
  classes: [cls("c10", "9.10", 9), cls("c2", "9.2", 9), cls("c11", "11.1", 11)],
  offerings: [
    offering("ma"),
    offering("de"),
    offering("fr", { groupKey: "sprache" }),
    offering("sn", { groupKey: "sprache" }),
    offering("ku", { groupKey: "kunst-musik", choiceRequired: true }),
    offering("mu", { groupKey: "kunst-musik", choiceRequired: true }),
    // Only class 9.2 has Informatik.
    offering("if", { groupKey: "informatik", classIds: [SchoolClass.Id.make("c2")] }),
    offering("ph", { gradeLevels: [11] }),
  ],
  courses: new Map([["fr", { name: "FR2a", subjectId: Subject.Id.make("fr") }]]),
  subjects: new Map([["fr", { name: "Französisch", shortName: "FR" }]]),
  enrollment: Option.none(),
};

const chooser = { termId: term, gradeLevel: 9, classId: SchoolClass.Id.make("c10") };
const ids = (values: Iterable<string>) => [...values].sort();

it("offers the grade levels of the term's courses and classes, and a grade's classes in number order", () => {
  assert.deepStrictEqual(Onboarding.gradeLevels(choices), [9, 11]);
  assert.deepStrictEqual(
    Onboarding.classesOf(choices, 9).map((each) => each.name),
    ["9.2", "9.10"],
  );
});

it("shows the elective groups open to the chooser's class, each named by its subjects", () => {
  const groups = Onboarding.electiveGroups(choices, chooser);

  assert.deepStrictEqual(groups.map(Onboarding.groupLabel), ["Französisch oder sn", "ku oder mu"]);
  assert.deepStrictEqual(
    groups.map((group) => group.required),
    [false, true],
  );
  assert.isTrue(
    Onboarding.electiveGroups(choices, { ...chooser, classId: SchoolClass.Id.make("c2") }).some(
      (group) => group.key === "informatik",
    ),
  );
});

it("choosing an elective leaves the other of its group, and choosing it again leaves it only where the group allows none", () => {
  const groups = Onboarding.electiveGroups(choices, chooser);

  const press = (chosen: ReadonlySet<Course.Id>, id: string) => {
    const group = groups.find((each) => each.electives.some((tile) => tile.courseId === id));
    const tile = group?.electives.find((each) => each.courseId === id);

    assert.isDefined(group);
    assert.isDefined(tile);

    return Onboarding.choose(chosen, group, tile);
  };

  const kunst = press(new Set([Course.Id.make("fr")]), "ku");
  const musik = press(kunst, "mu");

  assert.deepStrictEqual(ids(kunst), ["fr", "ku"]);
  assert.deepStrictEqual(ids(musik), ["fr", "mu"]);
  assert.deepStrictEqual(ids(press(musik, "mu")), ["fr", "mu"]);
  assert.deepStrictEqual(ids(press(musik, "fr")), ["mu"]);
});

it("starts the tiles from an earlier choice for the term", () => {
  const earlier = {
    ...choices,
    enrollment: Option.some({
      termId: term,
      gradeLevel: 9,
      classId: SchoolClass.Id.make("c10"),
      courseIds: ["de", "ma", "mu"].map((id) => Course.Id.make(id)),
    }),
  };

  assert.deepStrictEqual(ids(Onboarding.startingChoice(earlier, chooser)), ["mu"]);
});

const ready = (overrides: Partial<Onboarding.Snapshot> = {}): Onboarding.Reading =>
  Onboarding.Reading.Ready({
    snapshot: {
      id: Notebook.Id.make("lena"),
      schoolName: "Demoschule am Wiesengrund",
      profile: { displayName: "Lena", adult: false },
      term: Option.some(choices),
      refused: Option.none(),
      ...overrides,
    },
  });

const chosen = Option.some({
  ...choices,
  enrollment: Option.some({
    termId: term,
    gradeLevel: 9,
    classId: SchoolClass.Id.make("c10"),
    courseIds: [Course.Id.make("ma")],
  }),
});

it("waits for the first sync before it asks anything", () => {
  assert.strictEqual(Onboarding.next(Onboarding.Reading.Waiting()), "waiting");
});

it("asks for the name first, also when the school has no term today", () => {
  assert.strictEqual(Onboarding.next(ready({ profile: {} })), "who");
  assert.strictEqual(Onboarding.next(ready({ profile: {}, term: Option.none() })), "who");
});

it("lets nobody out with a name but no course choice for today's term", () => {
  assert.strictEqual(Onboarding.next(ready()), "courses");
  assert.strictEqual(Onboarding.next(ready({ term: chosen })), "done");
});

it("needs no course choice without a term, or when the term offers nothing to any grade", () => {
  assert.strictEqual(Onboarding.next(ready({ term: Option.none() })), "done");

  const nothing = Option.some({ ...choices, offerings: [], classes: [] });

  assert.strictEqual(Onboarding.next(ready({ term: nothing })), "done");
});

it("brings the course step back when the server refused the course choice", () => {
  const refused = Option.some({
    clientId: "device",
    mutationId: 3,
    reason: new Enrollment.CourseNotOffered({ courseId: Course.Id.make("ma") }),
  });

  assert.strictEqual(Onboarding.next(ready({ term: chosen, refused })), "courses");
});

it("lets a student without a school through to the overview", () => {
  assert.strictEqual(Onboarding.next(Onboarding.Reading.NoSchool()), "done");
});

it("a class answered for another grade level doesn't count for this one", () => {
  const earlier = Option.some(SchoolClass.Id.make("c10"));

  // Grade 11 has a class of its own, and grade 12 has none.
  for (const gradeLevel of [11, 12]) {
    const each = Onboarding.chooser(choices, gradeLevel, earlier);

    assert.isUndefined(each.classId);
    assert.strictEqual(Onboarding.classAnswered(choices, each), gradeLevel === 12);
  }

  const ninth = Onboarding.chooser(choices, 9, earlier);

  assert.strictEqual(ninth.classId, "c10");
  assert.isTrue(Onboarding.classAnswered(choices, ninth));
  assert.isFalse(Onboarding.classAnswered(choices, Onboarding.chooser(choices, 9, Option.none())));
});

it("greets by name once read, and without one when the read failed", () => {
  const failed = AsyncResult.fail("SqlError");

  for (const [reading, expected] of [
    [AsyncResult.initial(), Option.none()],
    [AsyncResult.initial(true), Option.none()],
    [AsyncResult.success(ready()), Option.some(Option.some("Lena"))],
    [AsyncResult.success(ready({ profile: {} })), Option.some(Option.none())],
    [AsyncResult.success(Onboarding.Reading.Waiting()), Option.some(Option.none())],
    [failed, Option.some(Option.none())],
    [
      AsyncResult.fail("SqlError", { previousSuccess: Option.some(AsyncResult.success(ready())) }),
      Option.some(Option.some("Lena")),
    ],
  ] as const) {
    assert.deepStrictEqual(Onboarding.greeting(reading), expected);
  }
});

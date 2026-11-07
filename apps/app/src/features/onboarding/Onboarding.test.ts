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
  extra: Partial<Pick<CourseOffering.Row, "classIds" | "groupKey" | "gradeLevels">> = {},
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
    offering("ku", { groupKey: "kunst-musik" }),
    offering("mu", { groupKey: "kunst-musik" }),
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

it("shows only electives open to the chooser's class, named by their subject", () => {
  const tiles = Onboarding.electives(choices, chooser);

  assert.deepStrictEqual(ids(tiles.map((tile) => tile.courseId)), ["fr", "ku", "mu", "sn"]);
  assert.deepStrictEqual(tiles.map(Onboarding.label).slice(0, 2), ["Französisch", "ku"]);
  assert.isTrue(
    Onboarding.electives(choices, { ...chooser, classId: SchoolClass.Id.make("c2") }).some(
      (tile) => tile.courseId === "if",
    ),
  );
});

it("choosing an elective leaves the other of its group, and choosing it again leaves it", () => {
  const tiles = Onboarding.electives(choices, chooser);

  const tile = (id: string) => {
    const found = tiles.find((each) => each.courseId === id);

    assert.isDefined(found);

    return found;
  };

  const kunst = Onboarding.toggle(new Set([Course.Id.make("fr")]), tile("ku"), tiles);
  const musik = Onboarding.toggle(kunst, tile("mu"), tiles);

  assert.deepStrictEqual(ids(kunst), ["fr", "ku"]);
  assert.deepStrictEqual(ids(musik), ["fr", "mu"]);
  assert.deepStrictEqual(ids(Onboarding.toggle(musik, tile("mu"), tiles)), ["fr"]);
});

it("writes every required course with the chosen electives that are still open", () => {
  const chosen = new Set(["fr", "ku", "if"].map((id) => Course.Id.make(id)));

  // Informatik belongs to 9.2, so a change to 9.10 drops it.
  assert.deepStrictEqual(ids(Onboarding.courseIds(choices, chooser, chosen)), [
    "de",
    "fr",
    "ku",
    "ma",
  ]);
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

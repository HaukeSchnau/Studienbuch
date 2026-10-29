/**
 * Die Demoschule: a fictional school with the students Lena and Tom, which development servers and
 * previews offer persona sign-in for and the store's reviewers sign in to on beta. Its rows follow
 * from the school year the seed runs in, so two seeds in one year write the same rows under the
 * same ids. Names are invented.
 */
import type { Demo } from "@stu/api/Demo";
import { CivilTime, Course, CourseOffering, Notebook, School, type Term } from "@stu/core";
import * as Effect from "effect/Effect";
import { Schools } from "../school/Schools.ts";

export * as DemoSchool from "./DemoSchool.ts";

export const id = School.Id.make("demo-schule");

/** Every demo course is offered to this grade level, and Lena and Tom are in it. */
export const gradeLevel = 11;

export const timeZone = CivilTime.TimeZone.make("Europe/Berlin");

/** One course of each subject, `ma-1` and so on. A student chooses Kunst or Musik. */
const subjects = [
  { id: "ma", name: "Mathematik", shortName: "MA", offering: {} },
  { id: "de", name: "Deutsch", shortName: "DE", offering: {} },
  { id: "en", name: "Englisch", shortName: "EN", offering: {} },
  { id: "bi", name: "Biologie", shortName: "BI", offering: {} },
  { id: "ch", name: "Chemie", shortName: "CH", offering: {} },
  { id: "ge", name: "Geschichte", shortName: "GE", offering: {} },
  { id: "pw", name: "Politik-Wirtschaft", shortName: "PW", offering: {} },
  { id: "ku", name: "Kunst", shortName: "KU", offering: { groupKey: "kunst-musik" } },
  { id: "mu", name: "Musik", shortName: "MU", offering: { groupKey: "kunst-musik" } },
  { id: "sp", name: "Sport", shortName: "SP", offering: {} },
] as const;

type SubjectId = (typeof subjects)[number]["id"];

const course = (subject: SubjectId) => Course.Id.make(`${subject}-1`);

/** The school's rows for the school year that holds `today`, with both terms offering every course. */
export const data = Effect.fn("DemoSchool.data")(function* (today: CivilTime.PlainDate) {
  const year = yield* Schools.yearAround(today);

  return {
    year,
    data: {
      id,
      school: { name: "Demoschule am Wiesengrund", timeZone },
      schoolYears: { [year.id]: year.row },
      terms: Object.fromEntries(year.terms.map((term) => [term.id, term.row])),
      subjects: Object.fromEntries(
        subjects.map((subject) => [
          subject.id,
          { name: subject.name, shortName: subject.shortName },
        ]),
      ),
      classes: {},
      courses: Object.fromEntries(
        subjects.map((subject) => [
          course(subject.id),
          { name: `${subject.shortName}-1`, subjectId: subject.id },
        ]),
      ),
      offerings: Object.fromEntries(
        year.terms.flatMap((term) =>
          subjects.map((subject) => [
            CourseOffering.idFor(course(subject.id), term.id),
            {
              courseId: course(subject.id),
              termId: term.id,
              gradeLevels: [gradeLevel],
              classIds: [],
              ...subject.offering,
            },
          ]),
        ),
      ),
    } satisfies Schools.Data,
  };
});

export interface Persona {
  readonly account: string;
  readonly email: string;
  readonly notebook: Notebook.Id;
  readonly courses: ReadonlyArray<Course.Id>;
}

/**
 * Their addresses are under `demo.studienbuch.app`, a domain of ours. The seed creates the accounts
 * before a sign-up could claim an address, and fails rather than adopt an account that has one.
 * The account and notebook ids are fixed, so every seed finds them again.
 */
export const personas: Readonly<Record<Demo.Persona, Persona>> = {
  lena: {
    account: "demo-lena",
    email: "lena@demo.studienbuch.app",
    notebook: Notebook.Id.make("demo-lena"),
    courses: (["ma", "de", "en", "bi", "ge", "ku", "sp"] as const).map(course),
  },
  tom: {
    account: "demo-tom",
    email: "tom@demo.studienbuch.app",
    notebook: Notebook.Id.make("demo-tom"),
    courses: (["ma", "de", "en", "ch", "pw", "mu", "sp"] as const).map(course),
  },
};

/** The persona's course choice in `term`. */
export const choice = (persona: Persona, term: Term.Id): Schools.Choice => ({
  termId: term,
  gradeLevel,
  courseIds: [...persona.courses].sort(),
});

/**
 * Two schools, each with its terms and courses, and Lena's notebook at the first, for core's tests.
 * Commands run the way an engine replays them: arguments encoded to JSON, decoded by
 * `Sync.invoke`, then run in one transaction.
 */
import { Sync, Tx } from "@stu/sync";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";
import { CivilTime } from "../civil-time/CivilTime.ts";
import { Enrollment } from "../notebook/Enrollment.ts";
import { Notebook } from "../notebook/Notebook.ts";
import { Course } from "../school/Course.ts";
import { CourseOffering } from "../school/CourseOffering.ts";
import { School } from "../school/School.ts";
import { SchoolClass } from "../school/SchoolClass.ts";
import { SchoolYear } from "../school/SchoolYear.ts";
import { Term } from "../school/Term.ts";
import { MemoryTx } from "./MemoryTx.ts";

export * as Fixture from "./Fixture.ts";

/** A date from its ISO form, for dates written out in a test. */
export const date = (iso: string) => PlainDateFns.fromString(iso, Calendar.getISO);

export const school = School.Id.make("demo-school");

export const notebook = Notebook.Id.make("notebook-lena");

export const schoolYear = SchoolYear.Id.make("demo-school-2026-27");

export const term = Term.Id.make("demo-2026-27-winter");

export const nextTerm = Term.Id.make("demo-2026-27-summer");

export const class111 = SchoolClass.Id.make("demo-11.1");

export const class112 = SchoolClass.Id.make("demo-11.2");

/** Mathematik on two levels, one elective group. */
export const mathE = Course.Id.make("demo-ma-e");

export const mathG = Course.Id.make("demo-ma-g");

/** Deutsch for class 11.2 only. */
export const german = Course.Id.make("demo-de-11.2");

/** Kunst for grade levels 12 and 13. */
export const art = Course.Id.make("demo-ku");

/** Another school, whose courses Lena's notebook must never reach. */
export const otherSchool = School.Id.make("other-school");

export const otherTerm = Term.Id.make("other-2026-27-winter");

export const otherMath = Course.Id.make("other-ma");

/** Writes rows the way the import and the admission do, outside any mutator. */
export const write = <T extends Sync.Any>(
  db: MemoryTx.Database,
  table: T,
  space: string,
  rows: ReadonlyArray<readonly [string, Sync.Row<T>]>,
) =>
  db.transaction(
    { actor: "server", writes: [table], location: "server" },
    Effect.flatMap(Tx.Service, (tx) =>
      Effect.forEach(rows, ([id, row]) => tx.put(table, space, id, row), { discard: true }),
    ),
  );

const offering = (
  termId: Term.Id,
  courseId: Course.Id,
  fields: Omit<CourseOffering.Row, "courseId" | "termId">,
) => [CourseOffering.idFor(courseId, termId), { courseId, termId, ...fields }] as const;

const winter = { start: date("2026-08-01"), end: date("2027-01-31") };

const summer = { start: date("2027-02-01"), end: date("2027-07-31") };

const timeZone = CivilTime.TimeZone.make("Europe/Berlin");

/** One school's year, its winter term and the given courses, all offered in that term. */
const writeSchool = Effect.fn("Fixture.writeSchool")(function* (
  db: MemoryTx.Database,
  space: School.Id,
  name: string,
  termId: Term.Id,
  courses: ReadonlyArray<
    readonly [Course.Id, string, Omit<CourseOffering.Row, "courseId" | "termId">]
  >,
) {
  const yearId = SchoolYear.Id.make(`${space}-2026-27`);

  yield* write(db, School.Row, space, [[space, { name, timeZone }]]);
  yield* write(db, SchoolYear.Row, space, [
    [yearId, { name: "2026/27", dates: { start: winter.start, end: summer.end } }],
  ]);
  yield* write(db, Term.Row, space, [
    [termId, { schoolYearId: yearId, name: "Winter 2026/27", dates: winter }],
  ]);
  yield* write(
    db,
    Course.Row,
    space,
    courses.map(([id, courseName]) => [id, { name: courseName }] as const),
  );
  yield* write(
    db,
    CourseOffering.Row,
    space,
    courses.map(([id, , fields]) => offering(termId, id, fields)),
  );
});

/**
 * A database holding both schools and Lena's notebook at the first one, without an enrollment yet.
 * The demo school's year has a summer term in which nothing is offered.
 */
export const make = Effect.gen(function* () {
  const db = MemoryTx.make();

  yield* writeSchool(db, school, "Demo-Schule", term, [
    [mathE, "MA-E", { gradeLevels: [11], classIds: [], groupKey: "MA" }],
    [mathG, "MA-G", { gradeLevels: [11], classIds: [], groupKey: "MA" }],
    [german, "DE 11.2", { gradeLevels: [11], classIds: [class112] }],
    [art, "KU", { gradeLevels: [12, 13], classIds: [], groupKey: "KU" }],
  ]);
  yield* write(db, Term.Row, school, [
    [nextTerm, { schoolYearId: schoolYear, name: "Sommer 2027", dates: summer }],
  ]);
  yield* write(db, SchoolClass.Row, school, [
    [class111, { schoolYearId: schoolYear, name: "11.1", gradeLevel: 11 }],
    [class112, { schoolYearId: schoolYear, name: "11.2", gradeLevel: 11 }],
  ]);
  yield* writeSchool(db, otherSchool, "Andere Schule", otherTerm, [
    [otherMath, "MA", { gradeLevels: [11], classIds: [] }],
  ]);
  yield* write(db, Notebook.Row, notebook, [[notebook, { schoolId: school }]]);

  return db;
});

/** Lena's enrollment for the winter term, as the admission writes it. */
export const enroll = (db: MemoryTx.Database, courseIds: ReadonlyArray<Course.Id>) =>
  write(db, Enrollment.Row, notebook, [
    [term, { termId: term, gradeLevel: 11, classId: class112, courseIds }],
  ]);

/** Runs one command as Lena's device or the server would, from its JSON arguments. */
export const run = Effect.fn("Fixture.run")(function* <
  Args,
  Writes extends ReadonlyArray<Sync.Any>,
>(
  db: MemoryTx.Database,
  mutator: Sync.Mutator<string, Args, { readonly _tag: string }, Writes>,
  args: Args,
  location: Tx.Location = "client",
) {
  const json = yield* Schema.encodeEffect(mutator.args)(args);
  const invocation = yield* Sync.invoke(mutator, mutator.version, json);

  return yield* db.transaction(
    { actor: "account-lena", writes: mutator.writes, location },
    invocation.run,
  );
});

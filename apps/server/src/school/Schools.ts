/**
 * A school's shared data on the server: publishing it to the school's space and its course spaces,
 * and reading what the school offers today. The dev schools and the demo school are built and
 * published here, and the import joins in M2.
 */
import {
  CivilTime,
  Course,
  CourseOffering,
  Enrollment,
  School,
  SchoolClass,
  SchoolYear,
  Subject,
  Term,
} from "@stu/core";
import { type Sync, Tx } from "@stu/sync";
import { PostgresTx, Spaces, SyncWriter } from "@stu/sync/server";
import * as Clock from "effect/Clock";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

export * as Schools from "./Schools.ts";

/** A table's rows by id, as JSON-ready values that its codec decodes. */
type Rows<T extends Sync.Any> = { readonly [id: string]: Schema.Struct.Encoded<T["fields"]> };

/** Everything in a School space, with the courses that get a Course space of their own. */
export interface Data {
  readonly id: School.Id;
  readonly school: Schema.Struct.Encoded<(typeof School.Row)["fields"]>;
  readonly schoolYears: Rows<typeof SchoolYear.Row>;
  readonly terms: Rows<typeof Term.Row>;
  readonly subjects: Rows<typeof Subject.Row>;
  readonly classes: Rows<typeof SchoolClass.Row>;
  readonly courses: Rows<typeof Course.Row>;
  readonly offerings: Rows<typeof CourseOffering.Row>;
}

/**
 * The id of a course's own space, from a hash of the school's and the course's ids, which together
 * can exceed the 64 characters of an id. The space's key is the course's id.
 */
export const courseSpace = Effect.fn("Schools.courseSpace")(function* (
  school: School.Id,
  course: string,
) {
  const crypto = yield* Crypto.Crypto;
  const name = new TextEncoder().encode(`${school}\u0000${course}`);
  const digest = yield* crypto.digest("SHA-256", name);

  return `course-${Hex.encode(digest.subarray(0, 16))}`;
}, Effect.orDie);

const entries = <T extends Sync.Any>(table: T, rows: Rows<T>) =>
  Effect.forEach(Object.entries(rows), ([id, row]) =>
    Effect.map(Schema.decodeUnknownEffect(table.codec)(row), (decoded) => ({
      id,
      // A table's codec decodes to its row by construction, which TypeScript can't see through `T`.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
      row: decoded as Sync.Row<T>,
    })),
  );

/**
 * Creates the school's spaces and makes its rows hold `data`, in one transaction. Rows that
 * `data` lacks stay, because a published term or course is never deleted. Publishing the same
 * data again writes nothing.
 */
export const publish = Effect.fn("Schools.publish")(function* (data: Data) {
  const sql = yield* SqlClient.SqlClient;
  const spaces = yield* Spaces.Service;
  const writer = yield* SyncWriter.Service;

  const write = <T extends Sync.Any>(table: T, rows: Rows<T>) =>
    Effect.flatMap(entries(table, rows), (decoded) => writer.reconcile(data.id, table, decoded));

  yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* spaces.create(data.id, School.Space);
      yield* write(School.Row, { [data.id]: data.school });
      yield* write(SchoolYear.Row, data.schoolYears);
      yield* write(Term.Row, data.terms);
      yield* write(Subject.Row, data.subjects);
      yield* write(SchoolClass.Row, data.classes);
      yield* write(Course.Row, data.courses);
      yield* write(CourseOffering.Row, data.offerings);

      for (const course of Object.keys(data.courses)) {
        yield* spaces.create(yield* courseSpace(data.id, course), Course.Space, {
          parent: data.id,
          key: course,
        });
      }
    }),
  );
  // The data is the caller's own constant or the import's checked records.
}, Effect.orDie);

const encodeDates = Schema.encodeEffect(CivilTime.DateRange);

/** The one course of a {@link simple} school's subject, such as `ma-1`. */
export const simpleCourse = (subject: string) => Course.Id.make(`${subject}-1`);

/** A subject of a {@link simple} school. Its course is an elective of `groupKey` where it names one. */
export interface SimpleSubject {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly groupKey?: string;
}

/**
 * A school without a timetable source, as the demo and the dev shortcuts make one: the school year
 * that holds today there (`SchoolYear.around`) with its halves `<year>-1` and `<year>-2`, no
 * classes, and one course of each subject offered to one grade level in both halves. The answer
 * names today, its half and the courses in the subjects' order.
 */
export const simple = Effect.fn("Schools.simple")(function* (options: {
  readonly id: School.Id;
  readonly name: string;
  readonly gradeLevel: School.GradeLevel;
  readonly subjects: ReadonlyArray<SimpleSubject>;
}) {
  const school = { name: options.name, timeZone: School.defaultTimeZone };
  const today = School.today(Option.some(school), yield* Clock.currentTimeMillis);
  const year = SchoolYear.around(today);

  const termId = (half: number) => Term.Id.make(`${year.id}-${half}`);

  const terms = yield* Effect.forEach(year.halves, (dates, index) =>
    Effect.map(encodeDates(dates), (encoded) => ({
      id: termId(index + 1),
      row: {
        schoolYearId: year.id,
        name: `${index + 1}. Halbjahr ${year.row.name}`,
        dates: encoded,
      },
    })),
  );

  const courses = options.subjects.map((subject) => ({
    id: simpleCourse(subject.id),
    subject,
    row: { name: `${subject.shortName}-1`, subjectId: subject.id },
  }));

  const data: Data = {
    id: options.id,
    school,
    schoolYears: { [year.id]: { name: year.row.name, dates: yield* encodeDates(year.row.dates) } },
    terms: Object.fromEntries(terms.map((term) => [term.id, term.row])),
    subjects: Object.fromEntries(
      options.subjects.map((subject) => [
        subject.id,
        { name: subject.name, shortName: subject.shortName },
      ]),
    ),
    classes: {},
    courses: Object.fromEntries(courses.map((course) => [course.id, course.row])),
    offerings: Object.fromEntries(
      terms.flatMap((term) =>
        courses.map((course) => {
          const { groupKey } = course.subject;

          const offering = {
            courseId: course.id,
            termId: term.id,
            gradeLevels: [options.gradeLevel],
            classIds: [],
          };

          // Row JSON holds no `undefined`, so a required course's offering leaves the key out.
          return [
            CourseOffering.idFor(course.id, term.id),
            groupKey === undefined ? offering : { ...offering, groupKey },
          ];
        }),
      ),
    ),
  };

  return {
    today,
    // The year holds today, so its second half does where its first doesn't.
    term: termId(CivilTime.contains(year.halves[0], today) ? 1 : 2),
    courseIds: courses.map((course) => course.id),
    data,
  };
  // A decoded date always encodes.
}, Effect.orDie);

/** `enrollment.set`'s arguments without the notebook: a term, a grade level and its courses. */
export type Choice = Omit<(typeof Enrollment.set.args)["Type"], "notebook">;

/** The server's own reads, of every space. */
const reading = <A, E>(effect: Effect.Effect<A, E, Tx.Service>) =>
  Effect.flatMap(PostgresTx.make({ actor: "", writes: [] }), (tx) =>
    Effect.provideService(effect, Tx.Service, tx),
  );

/** The school's term that holds today in its time zone, if any. */
export const currentTerm = Effect.fn("Schools.currentTerm")(function* (school: School.Id) {
  return yield* reading(
    Effect.gen(function* () {
      const read = yield* Tx.Service;
      const row = yield* read.get(School.Row, school, school);

      if (Option.isNone(row)) return Option.none<Term.Id>();

      const day = School.today(row, yield* Clock.currentTimeMillis);
      const term = Term.containing(yield* read.list(Term.Row, school), day);

      return Option.map(term, ({ id }) => Term.Id.make(id));
    }),
  );
}, Effect.orDie);

/**
 * The courses the school offers to the grade level in today's term, the first of each elective
 * group, or none when today is in no term. Where the grade level has classes that year, the choice
 * names the first of them, which `enrollment.set` requires.
 */
export const offered = Effect.fn("Schools.offered")(function* (
  school: School.Id,
  gradeLevel: School.GradeLevel,
) {
  const term = yield* currentTerm(school);

  if (Option.isNone(term)) return Option.none<Choice>();

  const termId = term.value;

  const { classId, offerings } = yield* reading(
    Effect.gen(function* () {
      const read = yield* Tx.Service;
      const year = yield* read.get(Term.Row, school, termId);

      const classes = Option.isNone(year)
        ? []
        : yield* read.list(SchoolClass.Row, school, {
            index: "schoolYearId",
            equals: year.value.schoolYearId,
          });

      return {
        classId: classes
          .filter(({ row }) => row.gradeLevel === gradeLevel)
          .map(({ id }) => SchoolClass.Id.make(id))
          .sort()[0],
        offerings: yield* read.list(CourseOffering.Row, school, {
          index: "termId",
          equals: termId,
        }),
      };
    }),
  );

  const chooser = { termId, gradeLevel, classId };
  const rows = offerings.map(({ row }) => row);

  return Option.some<Choice>({
    ...chooser,
    courseIds: Enrollment.courseIds(
      rows,
      chooser,
      rows.map((row) => row.courseId),
    ),
  });
}, Effect.orDie);

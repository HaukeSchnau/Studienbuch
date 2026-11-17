/**
 * A school's shared data on the server: publishing it to the school's space and its course spaces,
 * and reading what the school offers today. The dev schools and the demo school publish through
 * here, and the import joins in M2.
 */
import {
  type CivilTime,
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

// Data holds rows in their encoded form, as constants and the import's records write them. A
// school row encodes to itself, because a time zone is a string.
const encode = {
  schoolYear: Schema.encodeEffect(Schema.Struct(SchoolYear.Row.fields)),
  term: Schema.encodeEffect(Schema.Struct(Term.Row.fields)),
};

/** Today at the school, by the clock. */
export const today = (school: Pick<School.Row, "timeZone">) =>
  Effect.map(Clock.currentTimeMillis, (now) => School.today(school, now));

/** A subject of a {@link simple} school, with its one course. */
export interface SimpleSubject {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  /** The elective group of its course, absent for a required course. */
  readonly groupKey?: string;
  /** Whether a student must choose one course of its group. */
  readonly choiceRequired?: boolean;
}

/** The one course of a {@link simple} school's subject, such as `ma-1`. */
export const simpleCourse = (subject: string) => Course.Id.make(`${subject}-1`);

/**
 * A school for the demo and the dev shortcuts: the usual school year around `today` with its two
 * halves as terms (`2026-1`, `2026-2`), no classes, and one course per subject offered in both
 * terms to one grade level. The same arguments give the same rows. `term` is the one that holds
 * `today`.
 */
export const simple = Effect.fn("Schools.simple")(function* (options: {
  readonly id: School.Id;
  readonly school: School.Row;
  readonly today: CivilTime.PlainDate;
  readonly gradeLevel: School.GradeLevel;
  readonly subjects: ReadonlyArray<SimpleSubject>;
}) {
  const year = SchoolYear.around(options.today);
  const termId = (half: SchoolYear.Half) => Term.Id.make(`${year.id}-${half.number}`);

  const terms = yield* Effect.forEach(year.halves, (half) =>
    Effect.map(
      encode.term({ schoolYearId: year.id, name: half.name, dates: half.dates }),
      (row) => [termId(half), row] as const,
    ),
  );

  const data: Data = {
    id: options.id,
    school: options.school,
    schoolYears: { [year.id]: yield* encode.schoolYear(year.row) },
    terms: Object.fromEntries(terms),
    subjects: Object.fromEntries(
      options.subjects.map(({ id, name, shortName }) => [id, { name, shortName }]),
    ),
    classes: {},
    courses: Object.fromEntries(
      options.subjects.map((subject) => [
        simpleCourse(subject.id),
        { name: `${subject.shortName}-1`, subjectId: subject.id },
      ]),
    ),
    offerings: Object.fromEntries(
      year.halves.flatMap((half) =>
        options.subjects.map((subject) => {
          const courseId = simpleCourse(subject.id);

          const offering = {
            courseId,
            termId: termId(half),
            gradeLevels: [options.gradeLevel],
            classIds: [],
          };

          const { groupKey, choiceRequired } = subject;
          const elective = groupKey === undefined ? offering : { ...offering, groupKey };

          return [
            CourseOffering.idFor(courseId, termId(half)),
            choiceRequired === true ? { ...elective, choiceRequired } : elective,
          ];
        }),
      ),
    ),
  };

  return { data, term: termId(year.current) };
  // Rows built from decoded values always encode.
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

      const day = yield* today(row.value);
      const term = Term.containing(yield* read.list(Term.Row, school), day);

      return Option.map(term, ({ id }) => Term.Id.make(id));
    }),
  );
}, Effect.orDie);

/**
 * The courses the school offers to the grade level in today's term, one of each elective group, or
 * none when today is in no term. Where the grade level has classes that year, the choice names the
 * first of them, which `enrollment.set` requires.
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

  const rows = offerings.map(({ row }) => row);
  const chooser = { termId, gradeLevel, classId };
  const courseIds = Enrollment.courses(rows, chooser, new Set(rows.map((row) => row.courseId)));

  return Option.some<Choice>({ ...chooser, courseIds });
}, Effect.orDie);

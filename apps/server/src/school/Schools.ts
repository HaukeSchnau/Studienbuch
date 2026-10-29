/**
 * A school's shared data on the server: publishing it to the school's space and its course spaces,
 * and reading what the school offers today. The dev schools and the demo school publish through
 * here, and the import joins in M2.
 */
import {
  CivilTime,
  Course,
  CourseOffering,
  type Enrollment,
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

const encodeDate = Schema.encodeEffect(CivilTime.PlainDate);

/**
 * The school year `today` falls in, August 1 to July 31, and its two halves, with ids such as
 * `2026` and `2026-1`. `current` is the half that holds `today`.
 */
export const yearAround = Effect.fn("Schools.yearAround")(function* (today: CivilTime.PlainDate) {
  const [year = 0, month = 0] = (yield* encodeDate(today)).split("-").map(Number);
  const start = month >= 8 ? year : year - 1;
  const name = `${start}/${String(start + 1).slice(-2)}`;

  const half = (number: 1 | 2, dates: { readonly start: string; readonly end: string }) => ({
    id: Term.Id.make(`${start}-${number}`),
    row: { schoolYearId: `${start}`, name: `${number}. Halbjahr ${name}`, dates },
  });

  const first = half(1, { start: `${start}-08-01`, end: `${start + 1}-01-31` });
  const second = half(2, { start: `${start + 1}-02-01`, end: `${start + 1}-07-31` });

  return {
    id: `${start}`,
    row: { name, dates: { start: `${start}-08-01`, end: `${start + 1}-07-31` } },
    terms: [first, second] as const,
    current: month >= 8 || month === 1 ? first : second,
  };
  // A decoded date always encodes.
}, Effect.orDie);

/** Today in the time zone, by the clock. */
export const today = (timeZone: CivilTime.TimeZone) =>
  Effect.map(Clock.currentTimeMillis, (now) => CivilTime.dateIn(now, timeZone));

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

      const day = yield* today(row.value.timeZone);
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

  const groups = new Set<string>();
  const courseIds: Array<Course.Id> = [];

  for (const { row: offering } of offerings) {
    if (!CourseOffering.isFor(offering, { termId, gradeLevel, classId })) continue;

    if (offering.groupKey !== undefined) {
      if (groups.has(offering.groupKey)) continue;
      groups.add(offering.groupKey);
    }

    courseIds.push(offering.courseId);
  }

  return Option.some<Choice>({ termId, gradeLevel, classId, courseIds: courseIds.sort() });
}, Effect.orDie);

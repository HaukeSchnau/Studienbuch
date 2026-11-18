/**
 * A school's shared data on the server: publishing it to the school's space and its course spaces,
 * and reading what the school offers today. The dev schools and the demo school publish through
 * here, and the import joins in M2.
 */
import {
  CivilTime,
  Closure,
  Course,
  CourseOffering,
  Enrollment,
  ImportStatus,
  Lesson,
  Room,
  School,
  SchoolClass,
  SchoolYear,
  Subject,
  Teacher,
  Term,
  WeekLabel,
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

/** A row as JSON-ready values that its table's codec decodes. */
type Encoded<T extends Sync.Any> = Schema.Struct.Encoded<T["fields"]>;

/** A table's rows by id. */
type Rows<T extends Sync.Any> = { readonly [id: string]: Encoded<T> };

/** Everything in a School space and its Course spaces. */
export interface Data {
  readonly id: School.Id;
  readonly school: Encoded<typeof School.Row>;
  readonly schoolYears: Rows<typeof SchoolYear.Row>;
  readonly terms: Rows<typeof Term.Row>;
  readonly subjects: Rows<typeof Subject.Row>;
  readonly classes: Rows<typeof SchoolClass.Row>;
  /** Each gets a Course space of its own. */
  readonly courses: Rows<typeof Course.Row>;
  readonly offerings: Rows<typeof CourseOffering.Row>;
  readonly teachers: Rows<typeof Teacher.Row>;
  readonly rooms: Rows<typeof Room.Row>;
  readonly closures: Rows<typeof Closure.Row>;
  /** By ISO week, such as `2026-W47`. */
  readonly weekLabels: Rows<typeof WeekLabel.Row>;
  /** Absent, the published status stays as it is. */
  readonly importStatus?: Encoded<typeof ImportStatus.Row>;
  /** Lessons by course, for courses that `courses` holds. */
  readonly lessons: { readonly [course: string]: Rows<typeof Lesson.Row> };
}

/**
 * What a publish may remove of the published rows that `Data` lacks, which only its caller has
 * evidence for. A publish removes nothing else, and never a row that `Data` holds. Lessons and
 * closure dates are all it ever removes.
 */
export interface Removals {
  /** The school's date the evidence is from. Closure dates before it stay whatever it says. */
  readonly today: CivilTime.PlainDate;
  readonly lesson: (lesson: Tx.Entry<Lesson.Row>) => boolean;
  /** The dates the closure may lose. */
  readonly closureDates: (closure: Tx.Entry<Closure.Row>) => ReadonlyArray<CivilTime.DateRange>;
}

/**
 * Removes every lesson and every closure date from `today` on that `Data` lacks, for a caller that
 * owns all of the school's rows, such as the demo seed.
 */
export const removeMissing = (today: CivilTime.PlainDate): Removals => ({
  today,
  lesson: () => true,
  closureDates: ({ row }) => row.dates,
});

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

/** The server's own reads, of every space. */
const reading = <A, E>(effect: Effect.Effect<A, E, Tx.Service>) =>
  Effect.flatMap(PostgresTx.make({ actor: "", writes: [] }), (tx) =>
    Effect.provideService(effect, Tx.Service, tx),
  );

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
 * The dates of `ranges` that `keep` holds, as ranges in order that neither overlap nor touch, the
 * form `Closure.dates` takes.
 */
const datesWhere = (
  ranges: ReadonlyArray<CivilTime.DateRange>,
  keep: (date: CivilTime.PlainDate) => boolean,
) => {
  const days: Array<CivilTime.PlainDate> = [];

  for (const range of ranges) {
    for (let day = range.start; CivilTime.order(day, range.end) <= 0;) {
      if (keep(day)) days.push(day);
      day = CivilTime.addDays(day, 1);
    }
  }

  const kept: Array<{ start: CivilTime.PlainDate; end: CivilTime.PlainDate }> = [];

  for (const day of days.sort(CivilTime.order)) {
    const last = kept.at(-1);

    if (last === undefined || CivilTime.order(day, CivilTime.addDays(last.end, 1)) > 0) {
      kept.push({ start: day, end: day });
    } else if (CivilTime.order(day, last.end) > 0) {
      last.end = day;
    }
  }

  return kept;
};

/**
 * The closures as `data` and the published rows make them: every date `data` names, and every
 * published date that is before `removals.today` or that `removals` doesn't name. A closure left
 * without dates goes.
 */
const closuresAfter = (
  published: ReadonlyArray<Tx.Entry<Closure.Row>>,
  desired: ReadonlyArray<Tx.Entry<Closure.Row>>,
  removals: Removals,
) => {
  const before = new Map(published.map((entry) => [entry.id, entry]));
  const wanted = new Map(desired.map((entry) => [entry.id, entry]));
  const rows: Array<Tx.Entry<Closure.Row>> = [];
  const gone = new Set<string>();

  for (const id of new Set([...before.keys(), ...wanted.keys()])) {
    const old = before.get(id);
    const next = wanted.get(id);
    const removable = old === undefined ? [] : removals.closureDates(old);
    const named = next?.row.dates ?? [];

    const dates = datesWhere(
      [...named, ...(old?.row.dates ?? [])],
      (day) =>
        named.some((range) => CivilTime.contains(range, day)) ||
        CivilTime.order(day, removals.today) < 0 ||
        !removable.some((range) => CivilTime.contains(range, day)),
    );

    const name = next?.row.name ?? old?.row.name;

    if (dates.length === 0 || name === undefined) gone.add(id);
    else rows.push({ id, row: { name, dates } });
  }

  return { rows, gone };
};

/**
 * Makes the school's spaces hold `data` in one transaction, creating those it lacks. Rows `data`
 * lacks stay unless `removals` names them, and the same data again writes nothing. It locks the
 * School space and the Course spaces first, in id order as commands and `Spaces` do, and every
 * space of the school when it creates a Course space, whose regrant reads them all.
 */
export const publish = Effect.fn("Schools.publish")(function* (data: Data, removals: Removals) {
  const sql = yield* SqlClient.SqlClient;
  const spaces = yield* Spaces.Service;
  const writer = yield* SyncWriter.Service;

  const write = <T extends Sync.Any>(table: T, rows: Rows<T>) =>
    Effect.flatMap(entries(table, rows), (decoded) => writer.reconcile(data.id, table, decoded));

  const courses = new Map(
    yield* Effect.forEach(Object.keys(data.courses), (course) =>
      Effect.map(courseSpace(data.id, course), (space) => [course, space] as const),
    ),
  );

  const lessons = new Map(
    yield* Effect.forEach(Object.entries(data.lessons), ([course, rows]) =>
      Effect.gen(function* () {
        const decoded = yield* entries(Lesson.Row, rows);

        if (!courses.has(course) || decoded.some(({ row }) => row.courseId !== course)) {
          return yield* Effect.die(`The lessons of ${course} name another course or none`);
        }

        return [course, decoded] as const;
      }),
    ),
  );

  yield* sql.withTransaction(
    Effect.gen(function* () {
      yield* spaces.create(data.id, School.Space);

      const children = yield* sql<{
        readonly id: string;
        readonly kind: string;
        readonly key: string | null;
      }>`select id, kind, key from space where parent_id = ${data.id} order by id`;

      // The course spaces published so far, by their courses' ids, and those to create.
      const published = new Map(
        children.flatMap(({ id, kind, key }) =>
          kind === Course.Space.name && key !== null ? [[key, id] as const] : [],
        ),
      );

      const created = [...courses].filter(([course]) => !published.has(course));

      const locked =
        created.length === 0 ? [...published.values()] : children.map((child) => child.id);

      yield* sql`
        select 1 from space where id = any(${[data.id, ...locked]}) order by id
        for no key update
      `;

      yield* write(School.Row, { [data.id]: data.school });
      yield* write(SchoolYear.Row, data.schoolYears);
      yield* write(Term.Row, data.terms);
      yield* write(Subject.Row, data.subjects);
      yield* write(SchoolClass.Row, data.classes);
      yield* write(Course.Row, data.courses);
      yield* write(CourseOffering.Row, data.offerings);
      yield* write(Teacher.Row, data.teachers);
      yield* write(Room.Row, data.rooms);
      yield* write(WeekLabel.Row, data.weekLabels);

      if (data.importStatus !== undefined) {
        yield* write(ImportStatus.Row, { [data.id]: data.importStatus });
      }

      const closures = closuresAfter(
        yield* reading(Effect.flatMap(Tx.Service, (tx) => tx.list(Closure.Row, data.id))),
        yield* entries(Closure.Row, data.closures),
        removals,
      );

      yield* writer.reconcile(data.id, Closure.Row, closures.rows, {
        covers: ({ id }) => closures.gone.has(id),
      });

      yield* spaces.createMany(
        Course.Space,
        data.id,
        created.map(([key, id]) => ({ id, key })),
      );

      // Every course's space, also one whose lessons are now none.
      for (const [course, space] of new Map([...courses, ...published])) {
        yield* writer.reconcile(space, Lesson.Row, lessons.get(course) ?? [], {
          covers: removals.lesson,
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
 * terms to one grade level, without lessons. The same arguments give the same rows. `term` is the one that holds
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
    teachers: {},
    rooms: {},
    closures: {},
    weekLabels: {},
    lessons: {},
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

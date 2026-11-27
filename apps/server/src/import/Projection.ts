/**
 * From an import's result to what a publish writes (m2-import-path.md, section 4): the rows of the
 * School space and of each course's space as `Schools.Data`, and what the publish may remove as
 * `Schools.Removals`. It is pure, so the harness and the nightly self-check project without a
 * database. Only the profile's grade levels enter, and a lesson's text only as a stock phrase.
 */
import {
  CivilTime,
  Closure,
  Course,
  CourseOffering,
  Lesson,
  Room,
  SchoolClass,
  SchoolYear,
  Subject,
  Teacher,
  Term,
  WeekLabel,
} from "@stu/core";
import type { Sync } from "@stu/sync";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { Schools } from "../school/Schools.ts";
import { ImportIds } from "./ImportIds.ts";
import { SchoolProfile } from "./profiles/SchoolProfile.ts";
import { SchoolImport } from "./SchoolImport.ts";

export * as Projection from "./Projection.ts";

/**
 * A published lesson or closure that a snapshot lacked without evidence of where it went. It goes
 * when the next snapshot that covers it lacks it too, so one wrong answer never deletes.
 */
export const Candidate = Schema.Struct({
  rows: Schema.Literals(["lessons", "closures"]),
  id: Schema.String,
  start: SchoolImport.Day,
  end: SchoolImport.Day,
});

export type Candidate = typeof Candidate.Type;

export interface Input {
  readonly profile: SchoolProfile.SchoolProfile;
  /** What the last publish left, as `SchoolImport.apply` made it, without covers. */
  readonly previous: SchoolImport.ImportResult;
  /** This run's result, with its own covers. */
  readonly result: SchoolImport.ImportResult;
  /** What the last publish left waiting for a second snapshot. */
  readonly pending: ReadonlyArray<Candidate>;
  /** The school's date when the snapshot was read. Nothing before it changes. */
  readonly today: CivilTime.PlainDate;
}

export interface Projection {
  /** What the import knows once `result` lands on `previous`, as `SchoolImport.apply` makes it. */
  readonly state: SchoolImport.ImportResult;
  readonly data: Schools.Data;
  readonly removals: Schools.Removals;
  /** What waits for the next snapshot, for the checkpoint. */
  readonly pending: ReadonlyArray<Candidate>;
  /** Rows a table's codec refused, which stay out of the publish, by table and id. */
  readonly rejected: ReadonlyArray<{ readonly table: string; readonly id: string }>;
}

type Encoded<T extends Sync.Any> = Schema.Struct.Encoded<T["fields"]>;

/** Each row by its id, in its encoded form, without those its table's codec refuses. */
const tableOf = <T extends Sync.Any>(
  table: T,
  rows: ReadonlyArray<readonly [string, Encoded<T>]>,
  rejected: Array<{ readonly table: string; readonly id: string }>,
): { readonly [id: string]: Encoded<T> } => {
  const decodes = Schema.decodeUnknownOption(table.codec);

  return Object.fromEntries(
    rows.filter(([id, row]) => {
      const ok = Option.isSome(decodes(row));

      if (!ok) rejected.push({ table: table.name, id });

      return ok;
    }),
  );
};

/** Ids of WebUntis entries the result's links say a row came from. */
const entryIds = (result: SchoolImport.ImportResult) => {
  const ids = new Map<string, ReadonlyArray<number>>();

  for (const link of result.links) {
    ids.set(
      link.id,
      link.refs.flatMap((ref) => (ref._tag === "Entry" ? ref.ids : [])),
    );
  }

  return ids;
};

/**
 * The lessons of `previous` that `result` is evidence are gone. One goes at once when every view
 * shows its WebUntis entries in one other slot, with a lesson of its own course there. Anything
 * else, such as a renumbered entry or views that disagree, waits for the next snapshot. A row the
 * publish refuses is no evidence, and its day deletes nothing.
 */
const missingLessons = (
  input: Input,
  today: string,
  refused: ReadonlySet<string>,
  deletable: (date: string) => boolean,
) => {
  const { previous, result } = input;
  const present = new Set(result.lessons.map(({ id }) => id));
  const before = entryIds(previous);
  const after = entryIds(result);
  const claims = new Map<number, Array<SchoolImport.ImportedLesson>>();

  for (const lesson of result.lessons) {
    if (refused.has(lesson.id)) continue;

    for (const id of after.get(lesson.id) ?? []) {
      claims.set(id, [...(claims.get(id) ?? []), lesson]);
    }
  }

  const missing = previous.lessons.filter(
    (lesson) => today <= lesson.date && !present.has(lesson.id) && deletable(lesson.date),
  );

  const moved = new Set(
    missing.flatMap((lesson) => {
      const ids = before.get(lesson.id) ?? [];
      const claimed = ids.flatMap((id) => claims.get(id) ?? []);

      // An entry of a joint lesson that no lesson claims may be gone or renumbered, which only a
      // second snapshot tells apart.
      if (ids.some((id) => !claims.has(id))) return [];
      const slots = new Set(claimed.map(({ date, start }) => `${date} ${start}`));

      const ofCourse = new Set(
        claimed.flatMap(({ id, courseId }) => (courseId === lesson.courseId ? [id] : [])),
      );

      return slots.size === 1 && ofCourse.size === 1 ? [lesson.id] : [];
    }),
  );

  return {
    moved,
    candidates: missing.flatMap(({ id, date }): ReadonlyArray<Candidate> =>
      moved.has(id) ? [] : [{ rows: "lessons", id, start: date, end: date }],
    ),
  };
};

const dateOf = Schema.decodeUnknownOption(CivilTime.PlainDate);

/** The parts of `dates` from `start` to `end`. */
const within = (
  dates: ReadonlyArray<CivilTime.DateRange>,
  start: string,
  end: string,
): ReadonlyArray<CivilTime.DateRange> =>
  dates.flatMap((range) => {
    const from = CivilTime.format(range.start) < start ? dateOf(start) : Option.some(range.start);
    const to = end < CivilTime.format(range.end) ? dateOf(end) : Option.some(range.end);

    return Option.isSome(from) && Option.isSome(to) && CivilTime.order(from.value, to.value) <= 0
      ? [{ start: from.value, end: to.value }]
      : [];
  });

/**
 * Removals at once, the candidates from the last snapshot this one confirms, and the next ones. A
 * closure counts as listed only when it enters the publish, so a malformed one removes nothing,
 * and a confirmed one loses only the dates both snapshots covered.
 */
const removalsOf = (input: Input, published: Schools.Data, refused: ReadonlySet<string>) => {
  const { previous, result } = input;
  const today = CivilTime.format(input.today);

  const blocked = new Set(
    result.lessons.flatMap(({ id, date }) => (refused.has(id) ? [date] : [])),
  );

  // Lessons are of one day, so a day with a row the publish refuses deletes none of them.
  const deletes = (rows: Candidate["rows"], start: string, end: string) =>
    SchoolImport.deletes(result, rows, start, end) && (rows !== "lessons" || !blocked.has(start));

  const lessons = missingLessons(input, today, refused, (date) => deletes("lessons", date, date));

  const presentClosures = new Set(
    result.closures.flatMap(({ id }) => (id in published.closures ? [id] : [])),
  );

  const listed = new Set(result.closures.map(({ id }) => id));
  const present = new Set([...result.lessons.map(({ id }) => id), ...listed]);

  const closureCandidates = previous.closures
    .filter(
      (closure) =>
        today <= closure.end &&
        !listed.has(closure.id) &&
        SchoolImport.deletes(result, "closures", closure.start, closure.end),
    )
    .map(({ id, start, end }): Candidate => ({ rows: "closures", id, start, end }));

  const confirmed = new Map<string, Candidate>();
  const waiting: Array<Candidate> = [];

  for (const candidate of input.pending) {
    if (candidate.end < today || present.has(candidate.id)) continue;

    if (deletes(candidate.rows, candidate.start, candidate.end)) {
      confirmed.set(candidate.id, candidate);
    } else {
      waiting.push(candidate);
    }
  }

  const pending = new Map(
    [...waiting, ...lessons.candidates, ...closureCandidates].flatMap((candidate) =>
      confirmed.has(candidate.id)
        ? []
        : [[`${candidate.rows} ${candidate.id}`, candidate] as const],
    ),
  );

  const removals: Schools.Removals = {
    today: input.today,
    lesson: ({ id }) => lessons.moved.has(id) || confirmed.has(id),
    // A closure WebUntis still lists may lose the dates it no longer names, when the holiday read
    // covers all of them.
    closureDates: ({ id, row }) => {
      const gone = confirmed.get(id);

      // Two holiday reads lacked the whole closure, so its published dates from today that they
      // cover go, also those a snapshot that couldn't remove them took out of `previous` already.
      if (gone !== undefined) {
        return result.covers.flatMap((cover) =>
          cover.rows === "closures"
            ? within(row.dates, today < cover.start ? cover.start : today, cover.end)
            : [],
        );
      }

      const first = row.dates[0];
      const last = row.dates.at(-1);

      return presentClosures.has(id) &&
        first !== undefined &&
        last !== undefined &&
        SchoolImport.deletes(
          result,
          "closures",
          CivilTime.format(first.start),
          CivilTime.format(last.end),
        )
        ? row.dates
        : [];
    },
  };

  return { removals, pending: [...pending.values()] };
};

// A table's codec refuses a field that is present and undefined, so rows leave such fields out.

const courseRow = ({ name, subjectId, level }: typeof SchoolImport.ImportedCourse.Type) => {
  const row: Encoded<typeof Course.Row> = subjectId === undefined ? { name } : { name, subjectId };

  return level === undefined ? row : { ...row, level };
};

const offeringRow = (offering: SchoolImport.ImportedOffering) => {
  const { courseId, termId, gradeLevels, classIds, groupKey } = offering;
  const row = { courseId, termId, gradeLevels, classIds };

  return groupKey === undefined ? row : { ...row, groupKey };
};

/** The lesson as its row, with WebUntis's text only when it is one of the profile's stock phrases. */
/** The lesson with WebUntis's text only when it is one of the profile's stock phrases. */
export const withStockPhrase = (
  profile: SchoolProfile.SchoolProfile,
  lesson: SchoolImport.ImportedLesson,
): SchoolImport.ImportedLesson => {
  const { change, ...fields } = lesson;

  // A table's codec refuses a field that is present and undefined, which the import's rows have.
  if (change === undefined) return fields;

  const { text, ...rest } = change;

  const phrase = Option.flatMap(Option.fromUndefinedOr(text), (each) =>
    SchoolProfile.stockPhrase(profile, each),
  );

  return { ...fields, change: Option.isSome(phrase) ? { ...rest, text: phrase.value } : rest };
};

const lessonRow = (
  profile: SchoolProfile.SchoolProfile,
  lesson: SchoolImport.ImportedLesson,
): Encoded<typeof Lesson.Row> => {
  const { id: _, ...row } = withStockPhrase(profile, lesson);

  return row;
};

export const project = (input: Input): Projection => {
  const { profile } = input;
  const state = SchoolImport.apply(input.previous, input.result);
  const grades = new Set<number>(profile.gradeLevels);
  const rejected: Array<{ readonly table: string; readonly id: string }> = [];

  const classes = state.classes.filter(({ gradeLevel }) => grades.has(gradeLevel));
  const classIds = new Set<string>(classes.map(({ id }) => id));

  // An offering enters with the profile's grade levels and classes only. One that named classes
  // and keeps none isn't for the upper school, rather than for every class of it.
  const offerings = state.offerings.flatMap((offering) => {
    const gradeLevels = offering.gradeLevels.filter((grade) => grades.has(grade));
    const ofClasses = offering.classIds.filter((id) => classIds.has(id));

    return gradeLevels.length === 0 || (offering.classIds.length > 0 && ofClasses.length === 0)
      ? []
      : [{ ...offering, gradeLevels, classIds: ofClasses }];
  });

  const courseIds = new Set<string>(offerings.map(({ courseId }) => courseId));
  const courses = state.courses.filter(({ id }) => courseIds.has(id));
  const lessons = state.lessons.filter(({ courseId }) => courseIds.has(courseId));
  const subjectIds = new Set(courses.flatMap(({ subjectId }) => subjectId ?? []));

  const named = (pick: (lesson: SchoolImport.ImportedLesson) => ReadonlyArray<string>) =>
    new Set(lessons.flatMap(pick));

  const teacherIds = named((lesson) => [
    ...lesson.teacherIds,
    ...(lesson.change?.previousTeacherIds ?? []),
  ]);

  const roomIds = named((lesson) => [...lesson.roomIds, ...(lesson.change?.previousRoomIds ?? [])]);
  const byCourse = new Map<string, Array<readonly [string, Encoded<typeof Lesson.Row>]>>();

  for (const lesson of lessons) {
    byCourse.set(lesson.courseId, [
      ...(byCourse.get(lesson.courseId) ?? []),
      [lesson.id, lessonRow(profile, lesson)],
    ]);
  }

  const data: Schools.Data = {
    id: profile.id,
    school: profile.school,
    schoolYears: tableOf(
      SchoolYear.Row,
      state.schoolYears.map(({ id, name, start, end }) => [id, { name, dates: { start, end } }]),
      rejected,
    ),
    terms: tableOf(
      Term.Row,
      state.terms.map(({ id, schoolYearId, name, start, end }) => [
        id,
        { schoolYearId, name, dates: { start, end } },
      ]),
      rejected,
    ),
    subjects: tableOf(
      Subject.Row,
      state.subjects
        .filter(({ id }) => subjectIds.has(id))
        .map(({ id, name, shortName }) => [id, { name, shortName }]),
      rejected,
    ),
    classes: tableOf(
      SchoolClass.Row,
      classes.map(({ id, ...row }) => [id, row]),
      rejected,
    ),
    courses: tableOf(
      Course.Row,
      courses.map((course) => [course.id, courseRow(course)]),
      rejected,
    ),
    offerings: tableOf(
      CourseOffering.Row,
      offerings.map((offering) => [offering.id, offeringRow(offering)]),
      rejected,
    ),
    teachers: tableOf(
      Teacher.Row,
      state.teachers.filter(({ id }) => teacherIds.has(id)).map(({ id, ...row }) => [id, row]),
      rejected,
    ),
    rooms: tableOf(
      Room.Row,
      state.rooms.filter(({ id }) => roomIds.has(id)).map(({ id, ...row }) => [id, row]),
      rejected,
    ),
    closures: tableOf(
      Closure.Row,
      state.closures.map(({ id, name, start, end }) => [id, { name, dates: [{ start, end }] }]),
      rejected,
    ),
    weekLabels: tableOf(
      WeekLabel.Row,
      state.weeks.flatMap(({ week, label }) =>
        Option.match(ImportIds.weekLabel(week), {
          onNone: () => {
            rejected.push({ table: WeekLabel.Row.name, id: week });

            return [];
          },
          onSome: (id) => [[id, { label }] as const],
        }),
      ),
      rejected,
    ),
    lessons: Object.fromEntries(
      [...byCourse].map(([course, rows]) => [course, tableOf(Lesson.Row, rows, rejected)]),
    ),
  };

  const refused = new Set(
    rejected.flatMap(({ table, id }) => (table === Lesson.Row.name ? [id] : [])),
  );

  return { state, data, ...removalsOf(input, data, refused), rejected };
};

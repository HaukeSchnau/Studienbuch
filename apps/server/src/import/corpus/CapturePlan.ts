/**
 * What one capture reads (m2-import-corpus.md, section 2): the master data once, each planned
 * school year's directories and exams, then the timetables of every class, teacher, subject and
 * room and of the upper-school students, in four-week chunks over the year's windows. The plan
 * needs the directories, so it is made after reading them.
 */
import type {
  Exam,
  Holiday,
  Schoolyear,
  TimetableFilter,
  TimetableResourceType,
} from "@schnau/webuntis-api/schemas";
import { CivilTime } from "@stu/core";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { IgsLilienthal } from "../profiles/IgsLilienthal.ts";
import { SchoolProfile } from "../profiles/SchoolProfile.ts";

export * as CapturePlan from "./CapturePlan.ts";

export const types = [
  "CLASS",
  "TEACHER",
  "SUBJECT",
  "ROOM",
  "STUDENT",
] as const satisfies ReadonlyArray<TimetableResourceType>;

/** The longest range one timetable request asks for. */
export const chunkDays = 28;

/** How far past the capture's day the current year's timetables reach. */
export const aheadDays = 56;

/**
 * Whether a capture reads this student's timetable: one of their classes is in a grade level the
 * school's profile imports, IGS's upper school. The harness scores the same students.
 */
export const upperSchool = ({ classes }: TimetableFilter["students"][number]) =>
  classes.some(({ class: each }) =>
    Option.isSome(
      SchoolProfile.gradeLevelRead(
        IgsLilienthal.profile,
        IgsLilienthal.profile.classify(each.shortName),
      ),
    ),
  );

/** School years, the app data and the time grid. */
const masterReads = 3;

/** Per school year: one directory per resource type and the exam list. */
const yearReads = types.length + 1;

export interface Range {
  readonly start: string;
  readonly end: string;
}

export interface Window extends Range {
  readonly why: string;
}

export interface Directory {
  readonly filters: Readonly<Record<(typeof types)[number], TimetableFilter>>;
  readonly exams: ReadonlyArray<Pick<Exam, "examStart" | "deleted">>;
}

export interface YearPlan {
  readonly year: Schoolyear;
  readonly windows: ReadonlyArray<Window>;
  readonly chunks: ReadonlyArray<Range>;
  readonly resources: Readonly<Record<(typeof types)[number], ReadonlyArray<number>>>;
}

export interface Plan {
  readonly today: string;
  readonly years: ReadonlyArray<YearPlan>;
  readonly requests: number;
}

export class NoCurrentYear extends Schema.TaggedError<
  NoCurrentYear,
  { readonly brand: unique symbol }
>()("CapturePlan.NoCurrentYear", { today: Schema.String }) {}

const decodeDate = Schema.decodeEffect(CivilTime.PlainDate);
const encodeDate = Schema.encodeEffect(CivilTime.PlainDate);

const day = (text: string) => text.slice(0, 10);

const addDays = Effect.fn("CapturePlan.addDays")(function* (date: string, days: number) {
  return yield* encodeDate(CivilTime.addDays(yield* decodeDate(date), days));
});

const monday = Effect.fn("CapturePlan.monday")(function* (date: string) {
  const plain = yield* decodeDate(date);

  return yield* encodeDate(CivilTime.addDays(plain, 1 - CivilTime.dayOfWeek(plain)));
});

/**
 * The first day of a school year's second term: 1 February at IGS. The harness holds a student's
 * courses for each term that no case labels.
 */
export const termBoundary = (year: Schoolyear) => `${day(year.dateRange.end).slice(0, 4)}-02-01`;

const earlier = (a: string, b: string) => (a <= b ? a : b);
const later = (a: string, b: string) => (a >= b ? a : b);

/** The current year, which holds `today`, and the one before it, if WebUntis has it. */
export const planned = (years: ReadonlyArray<Schoolyear>, today: string) => {
  const current = years.find(
    ({ dateRange }) => day(dateRange.start) <= today && today <= day(dateRange.end),
  );

  const previous = years
    .filter(
      ({ dateRange }) => current !== undefined && day(dateRange.end) < day(current.dateRange.start),
    )
    .toSorted((a, b) => day(b.dateRange.end).localeCompare(day(a.dateRange.end)))[0];

  return current === undefined
    ? Effect.fail(new NoCurrentYear({ today }))
    : Effect.succeed(previous === undefined ? [current] : [current, previous]);
};

/** Ranges sorted and joined where they overlap or touch, then cut into chunks. */
const chunked = Effect.fn("CapturePlan.chunked")(function* (windows: ReadonlyArray<Range>) {
  const merged: Array<Range> = [];

  for (const window of windows.toSorted((a, b) => a.start.localeCompare(b.start))) {
    const last = merged.at(-1);

    if (last !== undefined && window.start <= (yield* addDays(last.end, 1))) {
      merged[merged.length - 1] = { start: last.start, end: later(last.end, window.end) };
    } else {
      merged.push({ start: window.start, end: window.end });
    }
  }

  const chunks: Array<Range> = [];

  for (const range of merged) {
    for (let start = range.start; start <= range.end; start = yield* addDays(start, chunkDays)) {
      chunks.push({ start, end: earlier(yield* addDays(start, chunkDays - 1), range.end) });
    }
  }

  return { merged, chunks };
});

/** The current year from its first day to eight weeks ahead. */
const currentWindows = Effect.fn("CapturePlan.currentWindows")(function* (
  year: Schoolyear,
  today: string,
) {
  return [
    {
      start: day(year.dateRange.start),
      end: earlier(yield* addDays(today, aheadDays), day(year.dateRange.end)),
      why: "this year to eight weeks ahead",
    },
  ];
});

/**
 * The previous year's term boundary, its three weeks with the most exams, and its last two school
 * weeks before the summer holidays, when the app data lists them.
 */
const previousWindows = Effect.fn("CapturePlan.previousWindows")(function* (
  year: Schoolyear,
  directory: Directory,
  holidays: ReadonlyArray<Holiday>,
) {
  const end = day(year.dateRange.end);
  const boundary = termBoundary(year);

  const byWeek = new Map<string, number>();

  for (const exam of directory.exams) {
    if (exam.deleted) continue;

    const week = yield* monday(day(exam.examStart));

    byWeek.set(week, (byWeek.get(week) ?? 0) + 1);
  }

  const examWeeks = [...byWeek]
    .toSorted(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
    .slice(0, 3);

  const summerAfter = yield* addDays(end, -aheadDays);

  const summer = holidays
    .flatMap(({ start }) => (summerAfter < day(start) && day(start) <= end ? [day(start)] : []))
    .toSorted()
    .at(-1);

  return [
    {
      start: yield* addDays(boundary, -14),
      end: yield* addDays(boundary, 13),
      why: "two weeks either side of the term boundary",
    },
    ...(yield* Effect.forEach(examWeeks, ([week, count]) =>
      Effect.map(addDays(week, 6), (sunday) => ({
        start: week,
        end: sunday,
        why: `a week with ${count} exams`,
      })),
    )),
    summer === undefined
      ? {
          start: yield* addDays(end, -13),
          end,
          why: "the year's last two weeks, as the app data lists no summer holidays",
        }
      : {
          start: yield* addDays(summer, -14),
          end: yield* addDays(summer, -1),
          why: "the last two weeks before the summer holidays",
        },
  ];
});

const resourcesOf = (filters: Directory["filters"]) => ({
  CLASS: filters.CLASS.classes.map(({ class: each }) => each.id),
  TEACHER: filters.TEACHER.teachers.map(({ teacher }) => teacher.id),
  SUBJECT: filters.SUBJECT.subjects.map(({ subject }) => subject.id),
  ROOM: filters.ROOM.rooms.map(({ room }) => room.id),
  STUDENT: filters.STUDENT.students.filter(upperSchool).map(({ student }) => student.id),
});

export const make = Effect.fn("CapturePlan.make")(function* (input: {
  readonly today: string;
  readonly years: ReadonlyArray<Schoolyear>;
  readonly holidays: ReadonlyArray<Holiday>;
  readonly directories: ReadonlyMap<number, Directory>;
}) {
  const years: Array<YearPlan> = [];

  for (const [index, year] of (yield* planned(input.years, input.today)).entries()) {
    const directory = input.directories.get(year.id);

    if (directory === undefined) continue;

    const wanted =
      index === 0
        ? yield* currentWindows(year, input.today)
        : yield* previousWindows(year, directory, input.holidays);

    const first = day(year.dateRange.start);
    const last = day(year.dateRange.end);

    const windows = wanted
      .map((window) => ({
        ...window,
        start: later(window.start, first),
        end: earlier(window.end, last),
      }))
      .filter(({ start, end }) => start <= end);

    years.push({
      year,
      windows,
      chunks: (yield* chunked(windows)).chunks,
      resources: resourcesOf(directory.filters),
    });
  }

  const timetables = years.reduce(
    (sum, { chunks, resources }) =>
      sum + types.reduce((each, type) => each + resources[type].length * chunks.length, 0),
    0,
  );

  return {
    today: input.today,
    years,
    requests: masterReads + years.length * yearReads + timetables,
  } satisfies Plan;
});

/** The days every timetable read covers, for the manifest. */
export const ranges = Effect.fn("CapturePlan.ranges")(function* (plan: Plan) {
  return (yield* chunked(plan.years.flatMap(({ chunks }) => chunks))).merged;
});

export const format = (plan: Plan) =>
  [
    `Capture plan for ${plan.today}`,
    ...plan.years.flatMap(({ year, windows, chunks, resources }) => [
      `${year.name} (school year ${year.id}): ${chunks.length} chunks of up to ${chunkDays} days`,
      ...windows.map(({ start, end, why }) => `  ${start}..${end}  ${why}`),
      `  resources: ${types.map((type) => `${resources[type].length} ${type}`).join(", ")} (students of grades 11 to 13)`,
      `  requests: ${yearReads} directories and exams, ${types.reduce((sum, type) => sum + resources[type].length * chunks.length, 0)} timetables`,
    ]),
    `Total: ${plan.requests} requests, ${masterReads} of them master data`,
  ].join("\n");

/**
 * What WebUntis showed last, as the harness's truth (m2-import-corpus.md, section 3): each
 * student's, teacher's and room's view of every captured school day, the changes among them, and
 * the exams. It reads the corpus through the recorded client, as of the capture's end.
 */
import type { WebUntisClient } from "@schnau/webuntis-api";
import type { Schoolyear, TimetableEntryDay } from "@schnau/webuntis-api/schemas";
import { CivilTime } from "@stu/core";
import * as Arr from "effect/Array";
import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import { CapturePlan } from "../corpus/CapturePlan.ts";
import type { Corpus } from "../corpus/Corpus.ts";
import { WebUntisEntry } from "../WebUntisEntry.ts";
import type { Metrics } from "./Metrics.ts";

export * as Truth from "./Truth.ts";

export const viewTypes = ["STUDENT", "TEACHER", "ROOM"] as const;

export type ViewType = (typeof viewTypes)[number];

export interface View {
  readonly type: ViewType;
  readonly id: number;
  /** The resource's short name, a token in a real corpus. */
  readonly name: string;
  readonly entries: ReadonlyArray<Metrics.TruthEntry>;
  /** The ISO weeks its timetable was read in. Only those weeks are measured for it. */
  readonly weeks: ReadonlySet<string>;
  /** Days WebUntis hid from the capture's account. They hold no entries and aren't measured. */
  readonly hidden: ReadonlySet<string>;
}

export interface Truth {
  /** Monday to Friday of every captured range, within a school year. */
  readonly days: ReadonlyArray<string>;
  /** The ISO week of each of `days`, such as `2026-W45`. */
  readonly weekOf: ReadonlyMap<string, string>;
  readonly views: ReadonlyArray<View>;
  /** Changed, cancelled and added entries, each once. */
  readonly changes: ReadonlyArray<Metrics.TruthEntry>;
  /** Every entry of the views, each once. */
  readonly entries: ReadonlyArray<Metrics.TruthEntry>;
  readonly exams: ReadonlyArray<Metrics.TruthExam>;
  /** WebUntis's holidays and the labelled days without school. */
  readonly closures: ReadonlyArray<{ readonly start: string; readonly end: string }>;
  /**
   * Each captured school year's two halves, split at the capture plan's term boundary: a day's
   * term when no case labels one.
   */
  readonly halves: ReadonlyArray<{
    readonly id: string;
    readonly start: string;
    readonly end: string;
  }>;
}

/** The truth is incomplete, so no number measured against it would mean anything. */
export class Incomplete extends Schema.TaggedError<Incomplete, { readonly brand: unique symbol }>()(
  "Truth.Incomplete",
  { read: Schema.String },
) {}

const decodeDate = Schema.decodeEffect(CivilTime.PlainDate);
const encodeDate = Schema.encodeEffect(CivilTime.PlainDate);

const schoolDays = Effect.fn("Truth.schoolDays")(function* (range: {
  readonly start: string;
  readonly end: string;
}) {
  const last = yield* decodeDate(range.end);
  const days: Array<readonly [string, string]> = [];

  for (let date = yield* decodeDate(range.start); CivilTime.order(date, last) <= 0;) {
    if (CivilTime.dayOfWeek(date) <= 5)
      days.push([yield* encodeDate(date), CivilTime.isoWeek(date)]);

    date = CivilTime.addDays(date, 1);
  }

  return days;
}, Effect.orDie);

const readEntries = (
  client: WebUntisClient["Service"],
  type: ViewType,
  resources: ReadonlyArray<number>,
  range: { readonly start: string; readonly end: string },
  schoolDays: ReadonlyArray<string>,
) =>
  Arr.isReadonlyArrayNonEmpty(resources)
    ? client.timetable.getEntriesForResources({ resourceType: type, resources, ...range }).pipe(
        Effect.orDie,
        Effect.flatMap((results) =>
          Effect.forEach(results, ({ resource, result }) =>
            // A school day WebUntis left out or wouldn't show, or explained with an error, is no
            // evidence of an empty timetable. A day it hid from the account is left out instead.
            Result.isSuccess(result) &&
            result.success.errors.length === 0 &&
            result.success.days.every(
              (day) => WebUntisEntry.shown(day) || WebUntisEntry.hidden(day),
            ) &&
            schoolDays.every((day) => result.success.days.some((each) => each.date.startsWith(day)))
              ? Effect.succeed({
                  resource,
                  days: result.success.days.filter(WebUntisEntry.shown),
                  hidden: result.success.days
                    .filter(WebUntisEntry.hidden)
                    .map((day) => day.date.slice(0, 10)),
                })
              : Effect.fail(new Incomplete({ read: `${type} ${resource} ${range.start}` })),
          ),
        ),
      )
    : Effect.succeed([]);

const incomplete = (read: string) => () => new Incomplete({ read });

type Range = { readonly start: string; readonly end: string };

/** The parts of `a` that lie within `b`. */
const within = (a: Range, b: Range): ReadonlyArray<Range> => {
  const start = [a.start, b.start].sort()[1] ?? a.start;
  const end = [a.end, b.end].sort()[0] ?? a.end;

  return start <= end ? [{ start, end }] : [];
};

/**
 * The timetables of the upper school's students, of the teachers and of the rooms, those of
 * `types` only, on the school days of `ranges`. Teachers and rooms are resolved through their
 * directories whichever types are read.
 */
export const readViews = Effect.fn("Truth.readViews")(function* (
  client: WebUntisClient["Service"],
  ranges: ReadonlyArray<Range>,
  types: ReadonlyArray<ViewType> = viewTypes,
) {
  const years = yield* client.schoolyears.list.pipe(Effect.mapError(incomplete("school years")));
  const views = new Map<string, View>();
  const read: Array<readonly [string, string]> = [];
  const parts: Array<Range & { readonly year: number }> = [];

  for (const range of ranges) {
    for (const year of years) {
      const [part] = within(range, {
        start: year.dateRange.start.slice(0, 10),
        end: year.dateRange.end.slice(0, 10),
      });

      if (part === undefined) continue;

      const { start, end } = part;
      const days = yield* schoolDays(part);
      const weeks = new Set(days.map(([, week]) => week));

      read.push(...days);
      parts.push({ ...part, year: year.id });

      const directory = (resourceType: ViewType) =>
        client.timetable
          .getFilter({ resourceType, start, end })
          .pipe(Effect.mapError(incomplete(`${resourceType} directory ${year.id}`)));

      // The capture reads the upper school's students only, so only they have a truth.
      const students = types.includes("STUDENT")
        ? (yield* directory("STUDENT")).students
            .filter(CapturePlan.upperSchool)
            .map((each) => each.student)
        : [];

      const teachers = (yield* directory("TEACHER")).teachers.map((each) => each.teacher);
      const rooms = (yield* directory("ROOM")).rooms.map((each) => each.room);
      const teacherIds = new Map(teachers.map(({ shortName, id }) => [shortName, id]));
      const roomIds = new Map(rooms.map(({ shortName, id }) => [shortName, id]));

      const idsOf = (names: ReadonlyArray<string>, directory_: ReadonlyMap<string, number>) =>
        names.flatMap((name) => Option.toArray(Option.fromNullishOr(directory_.get(name))));

      const entriesOf = (timetable: ReadonlyArray<TimetableEntryDay>) =>
        timetable.flatMap((day) =>
          day.gridEntries.map((entry): Metrics.TruthEntry => {
            const teacherNames = WebUntisEntry.names(entry, "TEACHER");
            const roomNames = WebUntisEntry.names(entry, "ROOM");

            return {
              date: day.date.slice(0, 10),
              ids: WebUntisEntry.ids(entry),
              start: Option.getOrElse(WebUntisEntry.timeOfDay(entry.duration.start), () => -1),
              end: Option.getOrElse(WebUntisEntry.timeOfDay(entry.duration.end), () => -1),
              status: WebUntisEntry.status(entry),
              teachers: idsOf(teacherNames.current, teacherIds),
              rooms: idsOf(roomNames.current, roomIds),
              previousTeachers: idsOf(teacherNames.removed, teacherIds),
              previousRooms: idsOf(roomNames.removed, roomIds),
              subjects: WebUntisEntry.names(entry, "SUBJECT").current,
            };
          }),
        );

      for (const [type, resources] of (
        [
          ["STUDENT", students],
          ["TEACHER", teachers],
          ["ROOM", rooms],
        ] as const
      ).filter(([type]) => types.includes(type))) {
        const names = new Map(resources.map(({ id, shortName }) => [id, shortName]));

        const timetables = yield* readEntries(
          client,
          type,
          resources.map(({ id }) => id),
          { start, end },
          days.map(([day]) => day),
        );

        // A resource read in several ranges is one view: its weeks of one range are no evidence
        // about another.
        for (const { resource, days: timetable, hidden } of timetables) {
          const key = `${type} ${resource}`;
          const earlier = views.get(key);

          views.set(key, {
            type,
            id: resource,
            name: names.get(resource) ?? String(resource),
            // Overlapping ranges read some days twice; each entry counts once.
            entries: [
              ...new Map(
                [...(earlier?.entries ?? []), ...entriesOf(timetable)].map((entry) => [
                  `${entry.date} ${entry.ids.join("+")}`,
                  entry,
                ]),
              ).values(),
            ],
            weeks: new Set([...(earlier?.weeks ?? []), ...weeks]),
            hidden: new Set([...(earlier?.hidden ?? []), ...hidden]),
          });
        }
      }
    }
  }

  const entries = [
    ...new Map(
      [...views.values()].flatMap((view) =>
        view.entries.map((entry) => [`${entry.date} ${entry.ids.join("+")}`, entry] as const),
      ),
    ).values(),
  ];

  return { views, read, parts, entries, years };
});

const halvesOf = Effect.fn("Truth.halvesOf")(function* (
  years: ReadonlyArray<Schoolyear>,
  captured: ReadonlySet<number>,
) {
  const halves: Array<{ readonly id: string; readonly start: string; readonly end: string }> = [];

  for (const year of years.filter(({ id }) => captured.has(id))) {
    const boundary = CapturePlan.termBoundary(year);
    const lastOfFirst = yield* encodeDate(CivilTime.addDays(yield* decodeDate(boundary), -1));

    halves.push(
      { id: `${year.name} 1`, start: year.dateRange.start.slice(0, 10), end: lastOfFirst },
      { id: `${year.name} 2`, start: boundary, end: year.dateRange.end.slice(0, 10) },
    );
  }

  return halves;
}, Effect.orDie);

/**
 * The kinds of views the corpus holds. An export of the source store has no teacher or room
 * views, so their measures say they measured nothing instead of the truth failing.
 */
export const typesIn = (corpus: Corpus.Corpus): ReadonlyArray<ViewType> =>
  viewTypes.filter((type) =>
    [...corpus.reads.keys()].some((path) => path.includes(`/entries/${type}/`)),
  );

/** What WebUntis showed at the capture's end. */
export const build = Effect.fn("Truth.build")(function* (corpus: Corpus.Corpus) {
  const { client } = yield* RecordedWebUntis.make(corpus.reads, {
    asOf: corpus.manifest.capturedAt,
  });

  const { views, read, parts, entries, years } = yield* readViews(
    client,
    corpus.manifest.ranges,
    typesIn(corpus),
  );

  const exams: Array<Metrics.TruthExam> = [];

  for (const { year, start, end } of parts) {
    const list = yield* client.exams
      .list({ start, end })
      .pipe(Effect.mapError(incomplete(`exams ${year}`)));

    exams.push(
      ...list.exams.map((exam) => ({
        id: exam.examId,
        date: exam.examStart.slice(0, 10),
        start: Option.getOrElse(WebUntisEntry.timeOfDay(exam.examStart), () => -1),
        end: Option.getOrElse(WebUntisEntry.timeOfDay(exam.examEnd), () => -1),
        students: exam.students.map((student) => student.id),
        teachers: exam.teachers.map((teacher) => teacher.id),
        subject: exam.subject.shortName,
      })),
    );
  }

  const weekOf = new Map(read);
  const appData = yield* client.app.getData.pipe(Effect.mapError(incomplete("app data")));

  return {
    days: [...weekOf.keys()].sort(),
    weekOf,
    views: [...views.values()],
    changes: entries.filter((entry) => entry.status !== "Regular"),
    entries,
    exams: [...new Map(exams.map((exam) => [exam.id, exam])).values()],
    closures: [
      ...appData.holidays.map((holiday) => ({
        start: holiday.start.slice(0, 10),
        end: holiday.end.slice(0, 10),
      })),
      ...corpus.cases.closures,
    ],
    halves: yield* halvesOf(years, new Set(parts.map(({ year }) => year))),
  } satisfies Truth;
});

/**
 * Every entry on the captured days of `range`, as WebUntis showed it at `asOf`, so a run is
 * measured against what it could have read.
 */
export const entriesAt = Effect.fn("Truth.entriesAt")(function* (
  corpus: Corpus.Corpus,
  asOf: DateTime.Utc,
  range: Range,
) {
  const { client } = yield* RecordedWebUntis.make(corpus.reads, { asOf });

  return (yield* readViews(
    client,
    corpus.manifest.ranges.flatMap((captured) => within(captured, range)),
    typesIn(corpus),
  )).entries;
});

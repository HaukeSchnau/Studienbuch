/**
 * What WebUntis showed last, as the harness's truth (m2-import-corpus.md, section 3): each
 * student's, teacher's and room's view of every captured school day, the changes among them, and
 * the exams. It reads the corpus through the recorded client, as of the capture's end.
 */
import type { WebUntisClient } from "@schnau/webuntis-api";
import type { TimetableEntryDay } from "@schnau/webuntis-api/schemas";
import { CivilTime } from "@stu/core";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
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
) =>
  Arr.isReadonlyArrayNonEmpty(resources)
    ? client.timetable.getEntriesForResources({ resourceType: type, resources, ...range }).pipe(
        Effect.orDie,
        Effect.flatMap((results) =>
          Effect.forEach(results, ({ resource, result }) =>
            // A day WebUntis wouldn't show, or explained with an error, is no evidence of an
            // empty timetable.
            Result.isSuccess(result) &&
            result.success.errors.length === 0 &&
            result.success.days.every(WebUntisEntry.shown)
              ? Effect.succeed({ resource, days: result.success.days })
              : Effect.fail(new Incomplete({ read: `${type} ${resource} ${range.start}` })),
          ),
        ),
      )
    : Effect.succeed([]);

export const build = Effect.fn("Truth.build")(function* (corpus: Corpus.Corpus) {
  const { client } = yield* RecordedWebUntis.make(corpus.reads, {
    asOf: corpus.manifest.capturedAt,
  });

  const incomplete = (read: string) => () => new Incomplete({ read });
  const years = yield* client.schoolyears.list.pipe(Effect.mapError(incomplete("school years")));
  const views = new Map<string, View>();
  const exams: Array<Metrics.TruthExam> = [];
  const read: Array<readonly [string, string]> = [];

  for (const range of corpus.manifest.ranges) {
    for (const year of years) {
      const start = [range.start, year.dateRange.start.slice(0, 10)].sort()[1] ?? range.start;
      const end = [range.end, year.dateRange.end.slice(0, 10)].sort()[0] ?? range.end;

      if (start > end) continue;

      const days = yield* schoolDays({ start, end });
      const weeks = new Set(days.map(([, week]) => week));

      read.push(...days);

      const directory = (resourceType: ViewType) =>
        client.timetable
          .getFilter({ resourceType, start, end })
          .pipe(Effect.mapError(incomplete(`${resourceType} directory ${year.id}`)));

      const students = (yield* directory("STUDENT")).students.map((each) => each.student);
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
            };
          }),
        );

      for (const [type, resources] of [
        ["STUDENT", students],
        ["TEACHER", teachers],
        ["ROOM", rooms],
      ] as const) {
        const names = new Map(resources.map(({ id, shortName }) => [id, shortName]));

        const timetables = yield* readEntries(
          client,
          type,
          resources.map(({ id }) => id),
          { start, end },
        );

        // A resource read in several ranges is one view: its weeks of one range are no evidence
        // about another.
        for (const { resource, days: timetable } of timetables) {
          const key = `${type} ${resource}`;
          const earlier = views.get(key);

          views.set(key, {
            type,
            id: resource,
            name: names.get(resource) ?? String(resource),
            entries: [...(earlier?.entries ?? []), ...entriesOf(timetable)],
            weeks: new Set([...(earlier?.weeks ?? []), ...weeks]),
          });
        }
      }

      const list = yield* client.exams
        .list({ start, end })
        .pipe(Effect.mapError(incomplete(`exams ${year.id}`)));

      exams.push(
        ...list.exams.map((exam) => ({
          id: exam.examId,
          date: exam.examStart.slice(0, 10),
          start: Option.getOrElse(WebUntisEntry.timeOfDay(exam.examStart), () => -1),
          end: Option.getOrElse(WebUntisEntry.timeOfDay(exam.examEnd), () => -1),
          students: exam.students.map((student) => student.id),
        })),
      );
    }
  }

  const weekOf = new Map(read);
  const appData = yield* client.app.getData.pipe(Effect.mapError(incomplete("app data")));

  const entries = [
    ...new Map(
      [...views.values()].flatMap((view) =>
        view.entries.map((entry) => [`${entry.date} ${entry.ids.join("+")}`, entry] as const),
      ),
    ).values(),
  ];

  return {
    days: [...weekOf.keys()].sort(),
    weekOf,
    views: [...views.values()],
    changes: entries.filter((entry) => entry.status !== "Regular"),
    entries,
    exams,
    closures: [
      ...appData.holidays.map((holiday) => ({
        start: holiday.start.slice(0, 10),
        end: holiday.end.slice(0, 10),
      })),
      ...corpus.cases.closures,
    ],
  } satisfies Truth;
});

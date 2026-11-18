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
}

export interface Truth {
  /** Monday to Friday of every captured range. */
  readonly days: ReadonlyArray<string>;
  /** The ISO week of each of `days`, such as `2026-W45`. */
  readonly weekOf: ReadonlyMap<string, string>;
  readonly views: ReadonlyArray<View>;
  /** Changed, cancelled and added entries, each once. */
  readonly changes: ReadonlyArray<Metrics.TruthEntry>;
  /** Every entry of the views, each once. */
  readonly entries: ReadonlyArray<Metrics.TruthEntry>;
  readonly exams: ReadonlyArray<Metrics.TruthExam>;
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
            Result.isSuccess(result)
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
  const views: Array<View> = [];
  const exams: Array<Metrics.TruthExam> = [];

  for (const range of corpus.manifest.ranges) {
    for (const year of years) {
      const start = [range.start, year.dateRange.start.slice(0, 10)].sort()[1] ?? range.start;
      const end = [range.end, year.dateRange.end.slice(0, 10)].sort()[0] ?? range.end;

      if (start > end) continue;

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

      const entriesOf = (days: ReadonlyArray<TimetableEntryDay>) =>
        days.flatMap((day) =>
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

        const read = yield* readEntries(
          client,
          type,
          resources.map(({ id }) => id),
          { start, end },
        );

        views.push(
          ...read.map(({ resource, days }) => ({
            type,
            id: resource,
            name: names.get(resource) ?? String(resource),
            entries: entriesOf(days),
          })),
        );
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

  const weekOf = new Map((yield* Effect.forEach(corpus.manifest.ranges, schoolDays)).flat());

  const entries = [
    ...new Map(
      views.flatMap((view) =>
        view.entries.map((entry) => [`${entry.date} ${entry.ids.join("+")}`, entry] as const),
      ),
    ).values(),
  ];

  return {
    days: [...weekOf.keys()],
    weekOf,
    views,
    changes: entries.filter((entry) => entry.status !== "Regular"),
    entries,
    exams,
  } satisfies Truth;
});

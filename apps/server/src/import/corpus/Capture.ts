/**
 * Reads WebUntis by the capture plan and writes the raw capture: a corpus directory whose reads
 * hold WebUntis's answers as `RecordedWebUntis` replays them (m2-import-corpus.md, sections 2 and
 * 7). It takes the client from its context and never logs in itself, so the server's import job
 * can run the same capture on its own connection (M2.9).
 */
import { WebUntisClient, withSchoolYear } from "@schnau/webuntis-api";
import {
  AppDataSchema,
  ExamsSchema,
  SchoolyearSchema,
  TimeGridSchema,
  TimetableFilterSchema,
} from "@schnau/webuntis-api/schemas";
import { CivilTime, School } from "@stu/core";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { RecordedWebUntis } from "../../infra/webuntis/RecordedWebUntis.ts";
import { CapturePlan } from "./CapturePlan.ts";
import { Corpus } from "./Corpus.ts";

export * as Capture from "./Capture.ts";

/** Requests in flight at once, which WebUntis has answered without a refusal. */
export const concurrency = 2;

export class ReadsFailed extends Schema.TaggedError<
  ReadsFailed,
  { readonly brand: unique symbol }
>()("Capture.ReadsFailed", {
  /** By kind, never by resource: a teacher's or student's id is a person's. */
  reads: Schema.Array(
    Schema.Struct({ read: Schema.String, error: Schema.String, count: Schema.Int }),
  ),
}) {
  override get message() {
    return `reads that failed:${this.reads.map(({ read, error, count }) => `\n  ${read}: ${error} (${count}×)`).join("")}`;
  }
}

// The decoded values of these reads are WebUntis's JSON without the fields their schemas don't
// model; webuntis-api keeps the raw body for timetable entries only.
const encodeYears = Schema.encodeEffect(Schema.toCodecJson(Schema.Array(SchoolyearSchema)));
const encodeAppData = Schema.encodeEffect(Schema.toCodecJson(AppDataSchema));
const encodeTimeGrid = Schema.encodeEffect(Schema.toCodecJson(TimeGridSchema));
const encodeFilter = Schema.encodeEffect(Schema.toCodecJson(TimetableFilterSchema));
const encodeExams = Schema.encodeEffect(Schema.toCodecJson(ExamsSchema));
const encodeDate = Schema.encodeEffect(CivilTime.PlainDate);
const decodeJson = Schema.decodeUnknownEffect(Schema.Json);

/** The day and the minute of an instant, as a capture's id: `capture-20261120-1900`. */
const idOf = (at: DateTime.Utc) =>
  `capture-${DateTime.formatIso(at).slice(0, 16).replace(/[-:]/gu, "").replace("T", "-")}`;

/**
 * Reads the master data, directories and exams, makes the plan and hands it to `onPlan`. Unless
 * `planOnly`, it then reads every planned timetable and writes the raw capture to `directory`.
 */
export const run = Effect.fn("Capture.run")(function* <E, R>(input: {
  readonly directory: string;
  readonly planOnly?: boolean;
  readonly onPlan: (plan: CapturePlan.Plan) => Effect.Effect<void, E, R>;
}) {
  const client = yield* WebUntisClient;
  let requests = 0;

  const observed = <A, E2, R2>(read: Effect.Effect<A, E2, R2>) =>
    read.pipe(
      Effect.tap(() => Effect.sync(() => requests++)),
      Effect.flatMap((value) => Effect.map(DateTime.now, (at) => ({ value, at }))),
    );

  const once = Effect.fn("Capture.once")(function* (
    name: string,
    body: Schema.Json,
    observedAt: DateTime.Utc,
  ) {
    if (input.planOnly !== true) {
      yield* Corpus.writeRead(input.directory, name, { versions: [{ observedAt, body }] });
    }
  });

  const today = CivilTime.dateIn(
    DateTime.toEpochMillis(yield* DateTime.now),
    School.defaultTimeZone,
  );

  const todayText = yield* encodeDate(today);

  const years = yield* observed(client.schoolyears.list);
  yield* once(RecordedWebUntis.paths.schoolYears, yield* encodeYears(years.value), years.at);

  const appData = yield* observed(client.app.getData);
  yield* once(RecordedWebUntis.paths.appData, yield* encodeAppData(appData.value), appData.at);

  const timeGrid = yield* observed(client.timetable.getTimeGrid);
  yield* once(RecordedWebUntis.paths.timeGrid, yield* encodeTimeGrid(timeGrid.value), timeGrid.at);

  const directories = new Map<number, CapturePlan.Directory>();

  for (const year of yield* CapturePlan.planned(years.value, todayText)) {
    const scoped = withSchoolYear(year.id);

    const range = {
      start: year.dateRange.start.slice(0, 10),
      end: year.dateRange.end.slice(0, 10),
    };

    const filters = yield* Effect.forEach(CapturePlan.types, (resourceType) =>
      observed(scoped(client.timetable.getFilter({ ...range, resourceType }))).pipe(
        Effect.tap(({ value, at }) =>
          Effect.flatMap(encodeFilter(value), (body) =>
            once(RecordedWebUntis.paths.filter(year.id, resourceType), body, at),
          ),
        ),
        Effect.map(({ value }) => value),
      ),
    );

    const exams = yield* observed(scoped(client.exams.list({ ...range, withDeleted: true })));
    yield* once(RecordedWebUntis.paths.exams(year.id), yield* encodeExams(exams.value), exams.at);

    const [CLASS, TEACHER, SUBJECT, ROOM, STUDENT] = filters;

    if (CLASS && TEACHER && SUBJECT && ROOM && STUDENT) {
      directories.set(year.id, {
        filters: { CLASS, TEACHER, SUBJECT, ROOM, STUDENT },
        exams: exams.value.exams,
      });
    }
  }

  const plan = yield* CapturePlan.make({
    today: todayText,
    years: years.value,
    holidays: appData.value.holidays,
    directories,
  });

  yield* input.onPlan(plan);

  if (input.planOnly === true) return { plan, manifest: undefined };

  const failed = new Map<string, { read: string; error: string; count: number }>();
  let decodeFailures = 0;

  for (const { year, chunks, resources } of plan.years) {
    for (const resourceType of CapturePlan.types) {
      const ids = resources[resourceType];
      const versions = new Map<number, Array<RecordedWebUntis.Version>>();

      if (!Arr.isReadonlyArrayNonEmpty(ids)) continue;

      for (const chunk of chunks) {
        const results = yield* withSchoolYear(year.id)(
          client.timetable.getEntriesForResources(
            { ...chunk, resourceType, resources: ids },
            { concurrency, raw: true },
          ),
        );

        const observedAt = yield* DateTime.now;

        requests += results.length;

        for (const { resource, raw, result } of results) {
          // A body that fails webuntis-api's schemas is kept as sent, so the harness counts it.
          if (
            Result.isFailure(result) &&
            (result.failure._tag !== "DecodeError" || raw === undefined)
          ) {
            const read = `${year.id}/entries/${resourceType} ${chunk.start}..${chunk.end}`;
            const error = result.failure._tag;
            const known = failed.get(`${read} ${error}`);

            failed.set(`${read} ${error}`, { read, error, count: (known?.count ?? 0) + 1 });

            continue;
          }

          if (Result.isFailure(result)) decodeFailures++;

          const body = yield* decodeJson(raw);
          const known = versions.get(resource) ?? [];

          versions.set(resource, [...known, { observedAt, ...chunk, body }]);
        }

        yield* Effect.logInfo("Capture read timetables", {
          year: year.name,
          type: resourceType,
          chunk: `${chunk.start}..${chunk.end}`,
          requests,
        });
      }

      yield* Effect.forEach(
        versions,
        ([resource, each]) =>
          Corpus.writeRead(
            input.directory,
            RecordedWebUntis.paths.entries(year.id, resourceType, resource),
            { versions: each },
          ),
        { discard: true },
      );
    }
  }

  if (failed.size > 0) return yield* new ReadsFailed({ reads: [...failed.values()] });

  const capturedAt = yield* DateTime.now;

  const manifest: Corpus.Manifest = {
    id: idOf(capturedAt),
    capturedAt,
    policy: 0,
    timeZone: School.defaultTimeZone,
    ranges: yield* CapturePlan.ranges(plan),
    requests,
    decodeFailures,
  };

  yield* Corpus.writeHead(input.directory, {
    manifest,
    cases: { changes: [], weeks: [], closures: [], courses: [], terms: [] },
  });

  return { plan, manifest };
});

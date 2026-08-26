import * as Config from "effect/Config";
import * as Context from "effect/Context";
import type * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import {
  AppClient,
  type SchoolyearsClient,
  type TimetableClient,
  type Schoolyear,
} from "@schnau/webuntis-api";
import { Database } from "../database/client.ts";
import { SourceObservationStore } from "../importing/source-observation-store.ts";
import { CourseProjectionStore } from "../organization/course-projection-store.ts";
import { DirectoryProjectionStore } from "../organization/directory-projection-store.ts";
import { TimetableProjectionStore } from "../schedule/timetable-projection-store.ts";
import { fetchDirectorySnapshot } from "./directory-snapshot.ts";
import { fetchStudentTimetableImportPlan } from "./student-timetable.ts";
import { WebUntisTimetable } from "./timetable.ts";

export class CurrentSchoolYearUnavailable extends Schema.TaggedError<CurrentSchoolYearUnavailable>()(
  "WebUntis.CurrentSchoolYearUnavailable",
  {},
) {}

export class ImportAlreadyRunning extends Schema.TaggedError<ImportAlreadyRunning>()(
  "WebUntis.ImportAlreadyRunning",
  { dataset: Schema.String },
) {}

type ImportedDataset = "directory" | "timetable" | "course-rosters";

const withImportLock = <A, E, R>(
  dataset: ImportedDataset,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<
  A,
  E | ImportAlreadyRunning | Database.Unavailable | Config.ConfigError,
  R | Database.Service
> =>
  Effect.gen(function* () {
    const database = yield* Database.Service;
    const schoolName = yield* Config.string("WEBUNTIS_SCHOOL_NAME");
    const lockKey = `studienbuch:webuntis:${schoolName}:${dataset}`;
    return yield* Effect.acquireUseRelease(
      Effect.tryPromise({
        try: () => database.pool.connect(),
        catch: (cause) =>
          Database.Unavailable.make({
            reason: cause instanceof Error ? cause.message : String(cause),
          }),
      }),
      (client) =>
        Effect.gen(function* () {
          const lock = yield* Effect.tryPromise({
            try: () =>
              client.query<{ readonly acquired: boolean }>(
                "select pg_try_advisory_lock(hashtextextended($1, 0)) as acquired",
                [lockKey],
              ),
            catch: (cause) =>
              Database.Unavailable.make({
                reason: cause instanceof Error ? cause.message : String(cause),
              }),
          });
          if (lock.rows[0]?.acquired !== true) {
            return yield* ImportAlreadyRunning.make({ dataset });
          }
          return yield* effect;
        }),
      (client) =>
        Effect.tryPromise({
          try: async () => {
            try {
              await client.query("select pg_advisory_unlock(hashtextextended($1, 0))", [lockKey]);
            } finally {
              client.release();
            }
          },
          catch: (cause) =>
            Database.Unavailable.make({
              reason: cause instanceof Error ? cause.message : String(cause),
            }),
        }).pipe(Effect.ignore({ log: true, message: "Failed to release WebUntis import lock" })),
    );
  });

export const fetchCurrentSchoolYear = Effect.fn("WebUntis.fetchCurrentSchoolYear")(function* () {
  const app = yield* AppClient;
  const current = (yield* app.getData).currentSchoolYear;
  if (current === null) return yield* CurrentSchoolYearUnavailable.make();
  return current satisfies Schoolyear;
});

/** Persists one directory snapshot and immediately replays the canonical directory. */
export const importDirectory = Effect.fn("WebUntis.importDirectory")(function* (
  requestedSchoolYear: string,
) {
  return yield* withImportLock(
    "directory",
    Effect.gen(function* () {
      const snapshot = yield* fetchDirectorySnapshot(requestedSchoolYear);
      const source = yield* SourceObservationStore.persistDirectorySnapshot(snapshot);
      const projection = yield* DirectoryProjectionStore.projectCurrent({
        dataSourceId: snapshot.preview.dataSourceId,
      });
      return { source, projection, preview: snapshot.preview } as const;
    }),
  );
});

/** Persists and projects every complete or partial daily scope in one fetched timetable range. */
export const importTimetable = Effect.fn("WebUntis.importTimetable")(function* (
  requestedSchoolYear: string,
  requestedStart: string,
  requestedEnd: string,
) {
  return yield* withImportLock(
    "timetable",
    Effect.gen(function* () {
      const plan = yield* WebUntisTimetable.fetchTimetableImportPlan(
        requestedSchoolYear,
        requestedStart,
        requestedEnd,
      );
      const runs = yield* Effect.forEach(
        plan.snapshots,
        (snapshot) =>
          Effect.gen(function* () {
            const source = yield* SourceObservationStore.persistSourceSnapshot(snapshot);
            const projection = yield* TimetableProjectionStore.projectCurrentScope({
              dataSourceId: snapshot.dataSourceId,
              scope: snapshot.scope,
            });
            return {
              scope: snapshot.scope,
              completeness: snapshot.completeness,
              source,
              projection,
            } as const;
          }),
        { concurrency: 3 },
      );
      return { preview: plan.preview, runs } as const;
    }),
  );
});

/** Persists private dated rosters and replays stable course identity across all current years. */
export const importCourseRosters = Effect.fn("WebUntis.importCourseRosters")(function* (
  requestedSchoolYear: string,
  requestedStart: string,
  requestedEnd: string,
) {
  return yield* withImportLock(
    "course-rosters",
    Effect.gen(function* () {
      const plan = yield* fetchStudentTimetableImportPlan(
        requestedSchoolYear,
        requestedStart,
        requestedEnd,
      );
      const runs = yield* Effect.forEach(
        plan.snapshots,
        (snapshot) => SourceObservationStore.persistSourceSnapshot(snapshot),
        { concurrency: 3 },
      );
      const projection = yield* CourseProjectionStore.projectCurrent({
        dataSourceId: plan.preview.dataSourceId,
      });
      return { preview: plan.preview, runs, projection } as const;
    }),
  );
});

export interface DirectoryImportSummary {
  readonly dataSourceId: string;
  readonly schoolYear: string;
  readonly sourceChanged: boolean;
  readonly projectionChanged: boolean;
  readonly changeCount: number;
}

export interface TimetableImportSummary {
  readonly dataSourceId: string;
  readonly schoolYear: string;
  readonly scopeCount: number;
  readonly completeScopeCount: number;
  readonly sourceChangedScopeCount: number;
  readonly projectionChangedScopeCount: number;
  readonly changeCount: number;
}

export interface CourseRosterImportSummary {
  readonly dataSourceId: string;
  readonly schoolYear: string;
  readonly scopeCount: number;
  readonly sourceChangedScopeCount: number;
  readonly annualObservationCount: number;
  readonly resolvedObservationCount: number;
  readonly unresolvedObservationCount: number;
  readonly createdOfferingCount: number;
  readonly changedCount: number;
}

const directorySummary = (
  result: Effect.Success<ReturnType<typeof importDirectory>>,
): DirectoryImportSummary => ({
  dataSourceId: result.preview.dataSourceId,
  schoolYear: result.preview.academicYear.name,
  sourceChanged: result.source._tag === "Imported",
  projectionChanged: result.projection._tag === "Projected",
  changeCount: Object.values(result.projection.changes).reduce((total, count) => total + count, 0),
});

const timetableSummary = (
  result: Effect.Success<ReturnType<typeof importTimetable>>,
): TimetableImportSummary => ({
  dataSourceId: result.preview.dataSourceId,
  schoolYear: result.preview.academicYear.name,
  scopeCount: result.runs.length,
  completeScopeCount: result.runs.filter((run) => run.completeness === "Complete").length,
  sourceChangedScopeCount: result.runs.filter((run) => run.source._tag === "Imported").length,
  projectionChangedScopeCount: result.runs.filter((run) => run.projection._tag === "Projected")
    .length,
  changeCount: result.runs.reduce(
    (total, run) =>
      total +
      Object.values(run.projection.changes).reduce((subtotal, count) => subtotal + count, 0),
    0,
  ),
});

const courseRosterSummary = (
  result: Effect.Success<ReturnType<typeof importCourseRosters>>,
): CourseRosterImportSummary => ({
  dataSourceId: result.preview.dataSourceId,
  schoolYear: result.preview.academicYear.name,
  scopeCount: result.runs.length,
  sourceChangedScopeCount: result.runs.filter((run) => run._tag === "Imported").length,
  annualObservationCount: result.projection.annualObservationCount,
  resolvedObservationCount: result.projection.resolvedObservationCount,
  unresolvedObservationCount: result.projection.unresolvedObservationCount,
  createdOfferingCount: result.projection.createdOfferingCount,
  changedCount: result.projection.changedCount,
});

type ImporterRequirements =
  | AppClient
  | SchoolyearsClient
  | TimetableClient
  | Database.Service
  | Crypto.Crypto;

/** Captures the live adapter context once so the worker can be tested through one focused seam. */
export class Service extends Context.Service<Service>()("@stu/server/webuntis/importer/Service", {
  make: Effect.gen(function* () {
    const context = yield* Effect.context<ImporterRequirements>();
    return {
      currentSchoolYear: fetchCurrentSchoolYear().pipe(Effect.provide(context)),
      importDirectory: (schoolYear: string) =>
        importDirectory(schoolYear).pipe(Effect.map(directorySummary), Effect.provide(context)),
      importTimetable: (schoolYear: string, start: string, end: string) =>
        importTimetable(schoolYear, start, end).pipe(
          Effect.map(timetableSummary),
          Effect.provide(context),
        ),
      importCourseRosters: (schoolYear: string, start: string, end: string) =>
        importCourseRosters(schoolYear, start, end).pipe(
          Effect.map(courseRosterSummary),
          Effect.provide(context),
        ),
    };
  }),
}) {}

export const layer = Layer.effect(Service, Service.make);

export * as WebUntisImporter from "./importer.ts";

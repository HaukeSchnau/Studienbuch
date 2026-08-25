import {
  Database,
  DirectoryProjectionStore,
  SourceObservationStore,
  TimetableProjectionStore,
  WebUntisCourseRosters,
  WebUntisDirectory,
  WebUntisTimetable,
} from "@stu/server";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { Command, Flag } from "effect/unstable/cli";

const schoolYear = Flag.string("school-year").pipe(
  Flag.withDescription("WebUntis school-year name"),
  Flag.withDefault("2026/2027"),
);

const apply = Flag.boolean("apply").pipe(
  Flag.withDescription("Persist the decoded WebUntis data"),
  Flag.withDefault(false),
);

const start = Flag.string("start").pipe(Flag.withDescription("First timetable date, YYYY-MM-DD"));

const end = Flag.string("end").pipe(Flag.withDescription("Last timetable date, YYYY-MM-DD"));

const courseAuditRange = Flag.string("range").pipe(
  Flag.withDescription("Repeatable SCHOOL_YEAR,START,END timetable audit range"),
  Flag.filterMap(
    (value) => {
      const [schoolYear, start, end, ...rest] = value.split(",");
      if (
        rest.length > 0 ||
        schoolYear === undefined ||
        start === undefined ||
        end === undefined ||
        schoolYear.length === 0 ||
        start.length === 0 ||
        end.length === 0
      ) {
        return Option.none();
      }
      return Option.some({ schoolYear, start, end });
    },
    () => "Expected SCHOOL_YEAR,START,END, for example 2026/2027,2026-08-24,2026-09-20",
  ),
);

const courseAuditRanges = Flag.atLeast(courseAuditRange, 1);

export const runWebUntisDirectoryPreview = Effect.fn("Console.webUntisDirectoryPreview")(function* (
  requestedSchoolYear: string,
) {
  const preview = yield* WebUntisDirectory.fetchDirectoryPreview(requestedSchoolYear);
  yield* Console.log(JSON.stringify(preview, null, 2));
  return preview;
});

export const runWebUntisDirectoryImport = Effect.fn("Console.webUntisDirectoryImport")(function* (
  requestedSchoolYear: string,
) {
  const snapshot = yield* WebUntisDirectory.fetchDirectorySnapshot(requestedSchoolYear);
  const source = yield* SourceObservationStore.persistDirectorySnapshot(snapshot);
  const projection = yield* DirectoryProjectionStore.projectCurrent({
    dataSourceId: snapshot.preview.dataSourceId,
  });
  const output = { source, projection, preview: snapshot.preview };
  yield* Console.log(JSON.stringify(output, null, 2));
  return output;
});

export const webUntisDirectoryCommand = Command.make(
  "webuntis-directory",
  { schoolYear, apply },
  ({ schoolYear, apply }) =>
    apply
      ? runWebUntisDirectoryImport(schoolYear).pipe(
          Effect.provide(Layer.merge(WebUntisDirectory.layer, Database.layerConfig)),
        )
      : runWebUntisDirectoryPreview(schoolYear).pipe(Effect.provide(WebUntisDirectory.layer)),
).pipe(Command.withDescription("Preview or persist a complete WebUntis school directory"));

export const runWebUntisTimetablePreview = Effect.fn("Console.webUntisTimetablePreview")(function* (
  requestedSchoolYear: string,
  requestedStart: string,
  requestedEnd: string,
) {
  const plan = yield* WebUntisTimetable.fetchTimetableImportPlan(
    requestedSchoolYear,
    requestedStart,
    requestedEnd,
  );
  yield* Console.log(JSON.stringify(plan.preview, null, 2));
  return plan.preview;
});

export const runWebUntisTimetableImport = Effect.fn("Console.webUntisTimetableImport")(function* (
  requestedSchoolYear: string,
  requestedStart: string,
  requestedEnd: string,
) {
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
        };
      }),
    { concurrency: 3 },
  );
  const output = { preview: plan.preview, runs };
  yield* Console.log(JSON.stringify(output, null, 2));
  return output;
});

export const webUntisTimetableCommand = Command.make(
  "webuntis-timetable",
  { schoolYear, start, end, apply },
  ({ schoolYear, start, end, apply }) =>
    apply
      ? runWebUntisTimetableImport(schoolYear, start, end).pipe(
          Effect.provide(Layer.merge(WebUntisTimetable.layer, Database.layerConfig)),
        )
      : runWebUntisTimetablePreview(schoolYear, start, end).pipe(
          Effect.provide(WebUntisTimetable.layer),
        ),
).pipe(Command.withDescription("Preview or persist identity-bearing WebUntis timetable views"));

export const runWebUntisCourseRosterPreview = Effect.fn("Console.webUntisCourseRosterPreview")(
  function* (requestedSchoolYear: string, requestedStart: string, requestedEnd: string) {
    const plan = yield* WebUntisCourseRosters.fetchStudentTimetableImportPlan(
      requestedSchoolYear,
      requestedStart,
      requestedEnd,
    );
    yield* Console.log(JSON.stringify(plan.preview, null, 2));
    return plan.preview;
  },
);

export const runWebUntisCourseRosterImport = Effect.fn("Console.webUntisCourseRosterImport")(
  function* (requestedSchoolYear: string, requestedStart: string, requestedEnd: string) {
    const plan = yield* WebUntisCourseRosters.fetchStudentTimetableImportPlan(
      requestedSchoolYear,
      requestedStart,
      requestedEnd,
    );
    const runs = yield* Effect.forEach(
      plan.snapshots,
      (snapshot) => SourceObservationStore.persistSourceSnapshot(snapshot),
      { concurrency: 3 },
    );
    const output = { preview: plan.preview, runs };
    yield* Console.log(JSON.stringify(output, null, 2));
    return output;
  },
);

export const webUntisCourseRosterCommand = Command.make(
  "webuntis-course-rosters",
  { schoolYear, start, end, apply },
  ({ schoolYear, start, end, apply }) =>
    apply
      ? runWebUntisCourseRosterImport(schoolYear, start, end).pipe(
          Effect.provide(Layer.merge(WebUntisCourseRosters.layer, Database.layerConfig)),
        )
      : runWebUntisCourseRosterPreview(schoolYear, start, end).pipe(
          Effect.provide(WebUntisCourseRosters.layer),
        ),
).pipe(Command.withDescription("Preview or persist private WebUntis course-roster evidence"));

export const runWebUntisCourseIdentityAudit = Effect.fn("Console.webUntisCourseIdentityAudit")(
  function* (ranges: ReadonlyArray<WebUntisTimetable.CourseIdentityAuditRange>) {
    const audit = yield* WebUntisTimetable.fetchCourseIdentityAudit(ranges);
    yield* Console.log(JSON.stringify(audit, null, 2));
    return audit;
  },
);

export const webUntisCourseIdentityAuditCommand = Command.make(
  "webuntis-course-audit",
  { ranges: courseAuditRanges },
  ({ ranges }) =>
    runWebUntisCourseIdentityAudit(ranges).pipe(Effect.provide(WebUntisTimetable.layer)),
).pipe(
  Command.withDescription(
    "Audit live WebUntis occurrence and course identity evidence without persistence",
  ),
);

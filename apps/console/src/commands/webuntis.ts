import {
  Database,
  DirectoryProjectionStore,
  SourceObservationStore,
  TimetableProjectionStore,
  WebUntisDirectory,
  WebUntisTimetable,
} from "@stu/server";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
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

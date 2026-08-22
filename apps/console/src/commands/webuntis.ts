import { Database, SourceObservationStore, WebUntisDirectory } from "@stu/server";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Command, Flag } from "effect/unstable/cli";

const schoolYear = Flag.string("school-year").pipe(
  Flag.withDescription("WebUntis school-year name"),
  Flag.withDefault("2026/2027"),
);

const apply = Flag.boolean("apply").pipe(
  Flag.withDescription("Persist and activate the complete directory snapshot"),
  Flag.withDefault(false),
);

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
  const result = yield* SourceObservationStore.persistDirectorySnapshot(snapshot);
  const output = { ...result, preview: snapshot.preview };
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

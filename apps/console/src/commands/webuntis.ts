import { WebUntisDirectory } from "@stu/server";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { Command, Flag } from "effect/unstable/cli";

const schoolYear = Flag.string("school-year").pipe(
  Flag.withDescription("WebUntis school-year name"),
  Flag.withDefault("2026/2027"),
);

export const runWebUntisDirectoryPreview = Effect.fn("Console.webUntisDirectoryPreview")(function* (
  requestedSchoolYear: string,
) {
  const preview = yield* WebUntisDirectory.fetchDirectoryPreview(requestedSchoolYear);
  yield* Console.log(JSON.stringify(preview, null, 2));
  return preview;
});

export const webUntisDirectoryCommand = Command.make(
  "webuntis-directory",
  { schoolYear },
  ({ schoolYear }) =>
    runWebUntisDirectoryPreview(schoolYear).pipe(Effect.provide(WebUntisDirectory.layer)),
).pipe(
  Command.withDescription("Preview the complete WebUntis school directory without writing it"),
);

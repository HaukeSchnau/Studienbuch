import { logInfoEvent } from "@stu/observability";
import * as Effect from "effect/Effect";
import { Command } from "effect/unstable/cli";

export const runPull = Effect.fn("Console.pull")(function* () {
  yield* logInfoEvent("console.pull.started");
});

export const pullCommand = Command.make("pull", {}, () => runPull());

import * as Effect from "effect/Effect";
import { Command } from "effect/unstable/cli";

export const runPull = Effect.fn("Console.pull")(function* () {
  yield* Effect.logInfo("console.pull.started", { event: "console.pull.started" });
});

export const pullCommand = Command.make("pull", {}, () => runPull());

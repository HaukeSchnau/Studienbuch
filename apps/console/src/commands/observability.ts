import { runCanary, type CanaryResult } from "@stu/observability";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { Command } from "effect/unstable/cli";

export const runObservabilityCanary: Effect.Effect<CanaryResult> = Effect.gen(function* () {
  const result = yield* runCanary().pipe(Effect.orDie);
  yield* Effect.logInfo("console.observability.canary.completed", {
    event: "console.observability.canary.completed",
  });
  return result;
}).pipe(Effect.withSpan("Console.observabilityCanary"));

export const observabilityCommand = Command.make("observability-canary", {}, () =>
  Effect.gen(function* () {
    const result = yield* runObservabilityCanary;
    yield* Console.log(JSON.stringify(result));
  }),
);

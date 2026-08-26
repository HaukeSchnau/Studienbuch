import { WebUntisPolling } from "@stu/server";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ImporterLive, withWorkerRuntime } from "./runtime.ts";

const PollingJob = Schema.Literals(WebUntisPolling.jobs);

Schema.decodeUnknownEffect(PollingJob)(process.argv[2]).pipe(
  Effect.flatMap(WebUntisPolling.runOnce),
  Effect.provide(ImporterLive),
  withWorkerRuntime,
  NodeRuntime.runMain,
);

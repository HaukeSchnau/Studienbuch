import { WebUntisPolling } from "@stu/server";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as Effect from "effect/Effect";
import { ImporterLive, withWorkerRuntime } from "./runtime.ts";

WebUntisPolling.run().pipe(Effect.provide(ImporterLive), withWorkerRuntime, NodeRuntime.runMain);

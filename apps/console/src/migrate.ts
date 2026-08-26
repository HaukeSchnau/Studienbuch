import { Database, Migrate } from "@stu/server";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as Effect from "effect/Effect";
import { withMigrationRuntime } from "./runtime.ts";

Migrate.migrateToLatest.pipe(
  Effect.provide(Database.layerConfig),
  withMigrationRuntime,
  NodeRuntime.runMain,
);

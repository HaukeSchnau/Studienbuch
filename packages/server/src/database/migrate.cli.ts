import * as Effect from "effect/Effect";
import { Database } from "./client.ts";
import { migrateToLatest } from "./migrate.ts";

/** Packaged entry point for the Project Release pre-deploy migration action. */
await Effect.runPromise(migrateToLatest.pipe(Effect.provide(Database.layerConfig)));

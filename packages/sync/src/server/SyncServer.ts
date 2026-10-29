/**
 * The server engine for one definition. `apps/server` provides it with Effect's `SqlClient` on
 * PostgreSQL 18, and the simulation on PGlite.
 */
import * as Layer from "effect/Layer";
import type { Sync } from "../definition/Sync.ts";
import { Spaces } from "./Spaces.ts";
import { SyncSchema } from "./SyncSchema.ts";
import { SyncWriter } from "./SyncWriter.ts";

export * as SyncServer from "./SyncServer.ts";

/** `Spaces` and `SyncWriter` for server code, over the checked definition. */
export const layer = (definition: Sync.Definition) =>
  Layer.mergeAll(Spaces.layer, SyncWriter.layer).pipe(
    Layer.provideMerge(SyncSchema.layer(definition)),
  );

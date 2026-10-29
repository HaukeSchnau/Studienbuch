/**
 * The server engine for one definition. `apps/server` provides it with Effect's `SqlClient` on
 * PostgreSQL 18, and the simulation on PGlite.
 */
import * as Layer from "effect/Layer";
import type { Sync } from "../definition/Sync.ts";
import { Contract } from "./Contract.ts";
import { Pull } from "./Pull.ts";
import { Push } from "./Push.ts";
import { Spaces } from "./Spaces.ts";
import { SyncSchema } from "./SyncSchema.ts";
import { SyncWriter } from "./SyncWriter.ts";

export * as SyncServer from "./SyncServer.ts";

export interface Options {
  /**
   * The oldest client the server serves. Raise `schema` in a release whose server needs clients
   * that read a replacement table, and older apps keep their data and wait for an update.
   */
  readonly minimum?: Contract.Minimum;
}

/** `Spaces` and `SyncWriter` alone, for server code that writes rows but serves no device. */
export const writers = (definition: Sync.Definition) =>
  Layer.mergeAll(Spaces.layer, SyncWriter.layer).pipe(
    Layer.provideMerge(SyncSchema.layer(definition)),
  );

/** Push and pull for connections, and `Spaces` and `SyncWriter` for server code. */
export const layer = (definition: Sync.Definition, options?: Options) => {
  const minimum = options?.minimum ?? Contract.initialMinimum;

  return Layer.mergeAll(Push.layer(minimum), Pull.layer(minimum)).pipe(
    Layer.provideMerge(writers(definition)),
  );
};

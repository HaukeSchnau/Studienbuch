import * as SqliteClient from "@effect/sql-sqlite-wasm/SqliteClient";
import * as Effect from "effect/Effect";

import { VirtualDevice } from "../device/VirtualDevice.ts";

/**
 * This device's database as `SqlClient`: Effect's wasm client with our worker, in the device's own
 * OPFS directory (ADR 0013). Open it only in the tab that owns the device (`DeviceGate`): a second
 * worker on the same directory waits forever instead of failing (ADR 0014).
 */
export const layer = SqliteClient.layer({
  worker: Effect.acquireRelease(
    Effect.sync(
      () =>
        new Worker(new URL("./opfs.worker", window.location.href), {
          name: `${VirtualDevice.directory}/studienbuch.db`,
        }),
    ),
    (worker) => Effect.sync(() => worker.terminate()),
  ),
  installReactivityHooks: true,
});

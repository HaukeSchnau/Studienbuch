import * as SqliteClient from "@effect/sql-sqlite-wasm/SqliteClient";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { TabOwner } from "../device/TabOwner.ts";
import { Databases } from "./Databases.ts";

// A browser: Effect's wasm client with our worker, each database in its own OPFS directory under
// `studienbuch/<device>/` (ADR 0013). The browser has no SQLCipher; what keeps an account's rows
// is the browser profile, and a public computer keeps them in memory only (encryption.md, local
// storage).

const root = "studienbuch";

const closed = (worker: Worker) =>
  Effect.callback<void>((resume) => {
    const onMessage = ({ data }: MessageEvent<unknown>) => {
      if (Array.isArray(data) && data[0] === "closed") resume(Effect.void);
    };

    worker.addEventListener("message", onMessage);

    return Effect.sync(() => worker.removeEventListener("message", onMessage));
  });

const workerName = (location: Databases.Location) =>
  location.memory ? ":memory:" : `${root}/${location.device}/${location.name}/db.sqlite`;

export const layer: Databases.Open = (location) =>
  Layer.unwrap(
    // Before the worker starts: one on a directory another tab holds waits forever (ADR 0014).
    Effect.as(
      TabOwner.own(location.device),
      SqliteClient.layer({
        worker: Effect.acquireRelease(
          Effect.sync(
            () =>
              new Worker(new URL("./opfs.worker", window.location.href), {
                name: workerName(location),
              }),
          ),
          // Effect's client has asked the worker to close. Once it closed its OPFS handles, the
          // database's directory can be deleted (opfs.worker.ts).
          (worker) =>
            closed(worker).pipe(
              Effect.timeout(Duration.seconds(2)),
              Effect.ignore,
              Effect.andThen(Effect.sync(() => worker.terminate())),
            ),
        ),
        installReactivityHooks: true,
      }),
    ),
  );

const notFound = (cause: unknown) =>
  cause instanceof DOMException && cause.name === "NotFoundError";

export const removeLeftovers: Databases.RemoveLeftovers = Effect.tryPromise(async () => {
  const opfs = await navigator.storage.getDirectory();

  for await (const [name, handle] of opfs.entries()) {
    if (handle.kind === "directory" && name.startsWith("device-")) {
      await opfs.removeEntry(name, { recursive: true });
    }
  }
}).pipe(Effect.catchCause((cause) => Effect.logWarning("M0's databases stay for now", cause)));

export const remove: Databases.Remove = (location) =>
  location.memory
    ? Effect.void
    : Effect.tryPromise({
        try: async () => {
          const opfs = await navigator.storage.getDirectory();
          const studienbuch = await opfs.getDirectoryHandle(root);
          const device = await studienbuch.getDirectoryHandle(location.device);

          await device.removeEntry(location.name, { recursive: true });
        },
        catch: (cause) => new Databases.RemoveFailed({ cause }),
      }).pipe(
        Effect.catchIf(
          (error) => notFound(error.cause),
          () => Effect.void,
        ),
      );

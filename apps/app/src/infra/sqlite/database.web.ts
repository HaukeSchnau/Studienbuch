import * as SqliteClient from "@effect/sql-sqlite-wasm/SqliteClient";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { TabOwner } from "../device/TabOwner.ts";
import { Databases } from "./Databases.ts";

// A browser: Effect's wasm client with our worker, each database in its own OPFS directory under
// `studienbuch/<device>/` (ADR 0013). The browser has no SQLCipher; what keeps an account's rows
// is the browser profile, and a public computer keeps them in memory only (encryption.md, local
// storage), as does a private window, which has no OPFS.

const root = "studienbuch";

const closed = (worker: Worker) =>
  Effect.callback<void>((resume) => {
    const onMessage = ({ data }: MessageEvent<unknown>) => {
      if (Array.isArray(data) && data[0] === "closed") resume(Effect.void);
    };

    worker.addEventListener("message", onMessage);

    return Effect.sync(() => worker.removeEventListener("message", onMessage));
  });

let offered: Promise<boolean> | undefined;

// Safari's private windows refuse `getDirectory` with an UnknownError, and a page outside a secure
// context has no `navigator.storage` at all. One answer per page.
const offersOpfs = async () => {
  try {
    await navigator.storage.getDirectory();

    return true;
  } catch {
    return false;
  }
};

export const keepsDatabases: Databases.Keeps = Effect.promise(() => (offered ??= offersOpfs()));

const workerName = (location: Databases.Location, kept: boolean) =>
  location.memory || !kept ? ":memory:" : `${root}/${location.device}/${location.name}/db.sqlite`;

export const layer: Databases.Open = (location) =>
  Layer.unwrap(
    Effect.gen(function* () {
      // Before the worker starts: one on a directory another tab holds waits forever (ADR 0014).
      yield* TabOwner.own(location.device);

      const kept = yield* keepsDatabases;

      return SqliteClient.layer({
        worker: Effect.acquireRelease(
          Effect.sync(
            () =>
              new Worker(new URL("./opfs.worker", window.location.href), {
                name: workerName(location, kept),
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
      });
    }),
  );

const notFound = (cause: unknown) =>
  cause instanceof DOMException && cause.name === "NotFoundError";

const removeM0 = Effect.tryPromise(async () => {
  const opfs = await navigator.storage.getDirectory();

  for await (const [name, handle] of opfs.entries()) {
    if (handle.kind === "directory" && name.startsWith("device-")) {
      await opfs.removeEntry(name, { recursive: true });
    }
  }
}).pipe(Effect.catchCause((cause) => Effect.logWarning("M0's databases stay for now", cause)));

// Without OPFS nothing was ever stored, so there is nothing to delete.
export const removeLeftovers: Databases.RemoveLeftovers = Effect.flatMap(keepsDatabases, (kept) =>
  kept ? removeM0 : Effect.void,
);

const removeDirectory = (location: Databases.Location) =>
  Effect.tryPromise({
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

export const remove: Databases.Remove = (location) =>
  location.memory
    ? Effect.void
    : Effect.flatMap(keepsDatabases, (kept) => (kept ? removeDirectory(location) : Effect.void));

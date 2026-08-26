import { TelemetryStorage, TelemetryStorageError } from "@stu/observability/browser";
import * as Effect from "effect/Effect";
import { Directory, File, Paths } from "expo-file-system";

const storageError = (operation: "read" | "write", cause: unknown) =>
  TelemetryStorageError.make({
    operation,
    reason: cause instanceof Error ? cause.message : String(cause),
  });

export const makeTelemetryFileStorage = (): TelemetryStorage["Service"] => {
  const directory = new Directory(Paths.document, "studienbuch", "observability");
  const snapshot = new File(directory, "outbox-v1.json");

  return TelemetryStorage.of({
    read: Effect.tryPromise({
      try: async () => (snapshot.exists ? snapshot.text() : undefined),
      catch: (cause) => storageError("read", cause),
    }),
    write: (contents) =>
      Effect.tryPromise({
        try: async () => {
          directory.create({ idempotent: true, intermediates: true });
          const temporary = new File(directory, "outbox-v1.tmp.json");
          temporary.create({ overwrite: true, intermediates: true });
          temporary.write(contents);
          await temporary.move(snapshot, { overwrite: true });
        },
        catch: (cause) => storageError("write", cause),
      }),
  });
};

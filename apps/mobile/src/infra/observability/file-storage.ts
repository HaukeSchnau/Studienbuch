import type { TelemetryStorage } from "@stu/observability/browser";
import { Directory, File, Paths } from "expo-file-system";

export const makeTelemetryFileStorage = (): TelemetryStorage => {
  const directory = new Directory(Paths.document, "studienbuch", "observability");
  const snapshot = new File(directory, "outbox-v1.json");

  return {
    read: async () => {
      if (!snapshot.exists) return undefined;
      return snapshot.text();
    },
    write: async (contents) => {
      directory.create({ idempotent: true, intermediates: true });
      const temporary = new File(directory, "outbox-v1.tmp.json");
      temporary.create({ overwrite: true, intermediates: true });
      temporary.write(contents);
      await temporary.move(snapshot, { overwrite: true });
    },
  };
};

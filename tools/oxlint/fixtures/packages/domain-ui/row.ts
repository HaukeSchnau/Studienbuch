// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: a dumb component reads SQLite
export { openDatabaseSync } from "expo-sqlite";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: a dumb component reads the sync engine
export { Sync } from "@stu/sync";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: an effect in domain UI
import { useEffect } from "react";

export function Row() {
  useEffect(() => undefined, []);

  return null;
}

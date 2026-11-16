import * as SqliteClient from "@effect/sql-sqlite-wasm/SqliteClient";
import * as SQLite from "expo-sqlite";

declare const sqlite3: { update_hook: (db: number, hook: () => void) => void };

export const opened = SQLite.openDatabaseAsync("lena.db", {
  // oxlint-disable-next-line studienbuch/no-sqlite-update-hooks -- fixture: expo-sqlite's option
  enableChangeListener: true,
});

// oxlint-disable-next-line studienbuch/no-sqlite-update-hooks -- fixture: expo-sqlite's listener
export const subscription = SQLite.addDatabaseChangeListener(() => {});

// oxlint-disable-next-line studienbuch/no-sqlite-update-hooks -- fixture: Effect's wasm client
export const client = SqliteClient.layerMemory({ installReactivityHooks: true });

// oxlint-disable-next-line studienbuch/no-sqlite-update-hooks -- fixture: wa-sqlite in a worker
sqlite3.update_hook(1, () => {});

export const quiet = SqliteClient.layerMemory({ installReactivityHooks: false });

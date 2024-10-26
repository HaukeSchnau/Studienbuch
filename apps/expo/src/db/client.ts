import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";

import * as schema from "./schema";

export const expoDb = openDatabaseSync("local.db", {
  enableChangeListener: true, // Needed for live queries
});
expoDb.execSync("PRAGMA foreign_keys = ON;");
export const db = drizzle(expoDb, {
  schema,
});

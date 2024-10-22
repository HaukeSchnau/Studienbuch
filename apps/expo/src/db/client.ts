import { openDatabaseSync } from "expo-sqlite/next";
import { drizzle } from "drizzle-orm/expo-sqlite";

import * as schema from "./schema";

export const expoDb = openDatabaseSync("local.db");
expoDb.execSync("PRAGMA foreign_keys = ON;");
export const db = drizzle(expoDb, {
  schema,
});

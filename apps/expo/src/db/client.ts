import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";

import * as schema from "@stu/student/schema";

// deleteDatabaseSync("local.db");
export const expoDb = openDatabaseSync("local.db");
expoDb.execSync("PRAGMA foreign_keys = ON;");
export const db = drizzle(expoDb, {
  schema,
});

import { openDatabaseSync } from "expo-sqlite/next";
import { drizzle } from "drizzle-orm/expo-sqlite";

import * as schema from "./schema";

export const expoDb = openDatabaseSync("local.db");
export const db = drizzle(expoDb, {
  schema,
});

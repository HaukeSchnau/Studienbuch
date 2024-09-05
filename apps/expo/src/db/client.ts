import { openDatabaseSync } from "expo-sqlite/next";
import { drizzle } from "drizzle-orm/expo-sqlite";

import * as schema from "./schema";

const expo = openDatabaseSync("local.db");
export const db = drizzle(expo, {
  schema,
});

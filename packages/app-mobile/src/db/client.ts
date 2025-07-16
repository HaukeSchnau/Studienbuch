import { Layer, Redacted } from "effect";

import * as schema from "@stu/student/schema";
import { Database } from "@stu/student";
import { makeService } from "@schnau/effect-drizzle/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";

// deleteDatabaseSync("local.db");
export const expoDb = openDatabaseSync("local.db");
export const db = drizzle(expoDb, {
  schema,
});

export const DatabaseLive = Layer.scoped(
  Database,
  makeService(
    {
      connection: expoDb,
      schema,
    },
    Database,
  ),
);
// db.delete(schema.events).execute();

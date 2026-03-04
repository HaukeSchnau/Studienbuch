import { makeService } from "@schnau/effect-drizzle/expo-sqlite";
import type { GenericDatabaseService } from "@schnau/effect-drizzle/generic-sqlite";
import { Database } from "@stu/student";
import * as schema from "@stu/student/schema";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { Layer } from "effect";
import type { Key } from "effect/ServiceMap";
import { openDatabaseSync } from "expo-sqlite";

// deleteDatabaseSync("local.db");
export const expoDb = openDatabaseSync("local.db");
export const db = drizzle(expoDb, {
  schema,
});

export const DatabaseLive = Layer.effect(
  Database,
  makeService(
    {
      connection: expoDb,
      schema,
    },
    Database as unknown as Key<any, GenericDatabaseService<typeof schema>>,
  ),
);
// db.delete(schema.events).execute();

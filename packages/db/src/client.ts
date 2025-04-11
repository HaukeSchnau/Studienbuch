import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import { env } from "../env";
import * as schema from "./schema";

const client = new pg.Client({
  connectionString: env.MANAGEMENT_DATABASE_URL,
});

await client.connect();
export const db = drizzle(client, {
  schema,
});

if (env.NODE_ENV === "production") {
  console.log("Migrating database");
  await migrate(db, {
    migrationsFolder: "./drizzle",
  });
  console.log("Database migrated");
}

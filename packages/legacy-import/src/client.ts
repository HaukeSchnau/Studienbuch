import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { env } from "../env";
import * as schema from "./schema";

const client = new pg.Client({
  connectionString: env.LEGACY_DATABASE_URL,
});

await client.connect();
export const db = drizzle(client, {
  schema,
});
